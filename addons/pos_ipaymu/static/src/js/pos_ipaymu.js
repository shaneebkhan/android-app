odoo.define("pos_ipaymu.pos_ipaymu", function(require) {
  "use strict";

  var rpc = require("web.rpc");
  var screens = require("point_of_sale.screens");
  var pos_model = require("point_of_sale.models");
  var Dialog = require("web.Dialog");
  var core = require("web.core");
  var check_status;
  var PaymentScreenWidget = screens.PaymentScreenWidget;

  var _t = core._t;

  pos_model.load_fields("account.journal", "pos_ipaymu_config_id");
  pos_model.load_fields("pos_ipaymu.configuration", "merchant_api_key");

  pos_model.PosModel = pos_model.PosModel.extend({

    getOnlinePaymentJournals: function() {
      var self = this;
      var online_payment_journals = [];

      $.each(this.journals, function(i, val) {
        if (val.pos_ipaymu_config_id) {
          online_payment_journals.push({
            label: self.getCashRegisterByJournalID(val.id).journal_id[1],
            item: val.id
          });
        }
      });

      return online_payment_journals;
    },
    getCashRegisterByJournalID: function(journal_id) {
      var cashregister_return;

      $.each(this.cashregisters, function(index, cashregister) {
        if (cashregister.journal_id[0] === journal_id) {
          cashregister_return = cashregister;
        }
      });

      return cashregister_return;
    }
  });

  // On Payment screen, allow electronic payments
  PaymentScreenWidget.include({
    // How long we wait for the odoo server to deliver the response of
    // a IPaymu transaction
    server_timeout_in_ms: 95000,
    start: function()
    {
      var lines_id = this.pos.get_order().get_paymentlines();
      this.pos.get_order().remove_paymentline(lines_id);
      this.reset_input();
      this.render_paymentlines();
    },

    // How many IPaymu transactions we send without receiving a
    // response
    server_retries: 3,

    _get_swipe_pending_line: function() {
      var i = 0;
      var lines = this.pos.get_order().get_paymentlines();

      for (i = 0; i < lines.length; i++) {
        if (lines[i].ipaymu_swipe_pending) {
          return lines[i];
        }
      }

      return 0;
    },
    click_delete_paymentline: function(id)
    {
      this.pos.get_order().remove_paymentline(id);
      $(".qr_code").remove()
      this.reset_input();
      this.render_paymentlines();
    },
    // make sure there is only one paymentline waiting for a swipe
    click_paymentmethods: function(id) {
      var numpad = $(".payment-numpad").html()
      var i;
      var order = this.pos.get_order();
      var cashregister = null;
      var self = this;
      var check;
      for (i = 0; i < this.pos.cashregisters.length; i++) {
        if (this.pos.cashregisters[i].journal_id[0] === id) {
          cashregister = this.pos.cashregisters[i];

          break;
        }
      }

      if (cashregister.journal.pos_ipaymu_config_id) {
        var already_swipe_pending = true;
        var lines = order.get_paymentlines();

        for (i = 0; i < lines.length; i++) {
          if (
            lines[i].cashregister.journal.pos_ipaymu_config_id &&
            lines[i].ipaymu_swipe_pending
          ) {
            already_swipe_pending = true;
          }
        }
        if (already_swipe_pending) {
          $(".next").hide()
          $(".numpad").hide()
          $(".js_set_customer").hide()
          this.pos.get_order().remove_paymentline(lines);
          this.reset_input();
          this.render_paymentlines();
          this._super(id);
          var total = $(".col-due").text()[$(".col-due").text().length -3];
                if(total == ',')
                {
                    total = $(".col-due").text().replace('.','').replace(',','.')
                }
                else
                {   
                    total = $(".col-due").text().replace(',','')
                }
          var please_wait_prompt = new Dialog(document.body, {
            title: "",
            subtitle: "",
            size: "medium",
            $content:
              '<div style="height:500px;width:500px"><h1>please wait...</h1></div>',
            buttons: []
          });
          please_wait_prompt.open();

          rpc
            .query({
              model: "pos_ipaymu.configuration",
              method: "get_qr_code",
              args: [
                {
                  amount: total,
                  uniqid: order.name.match(/[0-9]/gm).join("")
                }

              ]
            })
            .then(function(result_get_qr) {
            
              please_wait_prompt.close();
              var response = JSON.parse(result_get_qr);
              if (response['Status'] < -1) {
                  self.gui.show_popup('error', {
                      'title': _t('ipaymu API error'),
                      'body': response['Keterangan'],
                  })
              } else {
                $(".qr_code").remove()
                $(".payment-numpad").append('<div class="qr_code" style="height:500px;width:500px"><h2>Scan this QR Code To Validate Payment</h2><img src="data:image/jpeg;base64,' +
                        response.QrCode + '" style="height:250px;width:250px"></div>')           
                clearInterval(check_status);
                check_status = setInterval(function() {
                  rpc
                    .query({
                      model: "pos_ipaymu.configuration",
                      method: "get_status_payment",
                      args: [
                        {
                          trx_id: response.TrxId
                        }
                      ]
                    })
                    .then(function(result_check_status) {
                      var response = JSON.parse(result_check_status);
                      if (response.Keterangan == "Berhasil") {
                        clearInterval(check_status);
                        self.validate_order();
                      }
                    });
                }, 5000);
              }
            });
        }
      } else {
        clearInterval(check_status);
        $(".qr_code").hide();
        $(".next").show()
        $(".js_set_customer").show()
        $(".numpad").show();
        clearInterval(check);
        var lines_id = this.pos.get_order().get_paymentlines();
        this.pos.get_order().remove_paymentline(lines_id);
        this.reset_input();
        this.render_paymentlines();
        this._super(id);
      }
    },

    // before validating, get rid of any paymentlines that are waiting on a swipe.
    validate_order: function(force_validation) {
      clearInterval(check_status);
      $(".next").show()
      $(".qr_code").hide();
      $(".numpad").show()
      if (this.pos.get_order().is_paid() && !this.invoicing) {
        var lines = this.pos.get_order().get_paymentlines();
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].ipaymu_swipe_pending) {
            this.pos.get_order().remove_paymentline(lines[i]);
            this.render_paymentlines();
          }
        }
      }

      this._super(force_validation);
    }
  });
});
