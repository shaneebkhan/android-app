(function () {
"use strict";

var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

class Multirange {
    constructor(input, options = {}) {
        var self = this;

        /* Set default and optionnal values */
        this.input = input;
        this.counterInput = options.displayCounterInput === false ? false : true;
        var value = options.value || this.input.getAttribute("value");
        var values = value === null ? [] : value.split(",");
        this.input.min = this.min = options.min || this.input.min || 0;
        this.input.max = this.max = options.max || this.input.max || 100;
        this.input.step = this.step = options.step || this.input.step || 1;
        this.currency = options.currency || this.input.dataset.currency || '';
        this.currencyPosition = options.currencyPosition || this.input.dataset.currencyPosition || 'after';

        /* Wrap the input and add its ghost */
        this.rangeDiv = document.createElement("div");
        this.rangeDiv.classList = "multirange-wrapper";
        this.input.parentNode.insertBefore(this.rangeDiv, this.input.nextSibling);
        this.rangeDiv.appendChild(this.input);
        this.ghost = this.input.cloneNode();
        this.rangeDiv.appendChild(this.ghost);

        this.input.classList.add("multirange", "original");
        this.ghost.classList.add("multirange", "ghost");
        this.input.value = values[0] || this.min;
        this.ghost.value = values[1] || this.max;

        /* Add the counterInput */
        if (this.counterInput) {
            this.leftCounter = document.createElement("span");
            this.leftCounter.classList = "multirange-min";
            this.rightCounter = document.createElement("span");
            this.rightCounter.classList = "multirange-max";

            this.leftInput = document.createElement("input");
            this.leftInput.type = "number";
            this.leftInput.style.display = "none";
            this.leftInput.size = this.max.toString().length;
            this.leftInput.min = this.min;
            this.leftInput.max = this.max;
            this.leftInput.step = this.step;
            this.rightInput = this.leftInput.cloneNode();

            this.leftInput.classList = "multirange-min";
            this.rightInput.classList = "multirange-max";

            this.rangeDiv.appendChild(this.leftCounter);
            this.rangeDiv.appendChild(this.leftInput);
            this.rangeDiv.appendChild(this.rightCounter);
            this.rangeDiv.appendChild(this.rightInput);
        }

        /* Define new properties on range input to link it with ghost, especially for Safari compatibility*/
        Object.defineProperty(this.input, "originalValue", descriptor.get ? descriptor : {
            get: function () {
                return this.value;
            },
            set: function (v) {
                this.value = v;
            }
        });

        Object.defineProperties(this.input, {
            valueLow: {
                get: function () {
                    return Math.min(this.originalValue, self.ghost.value);
                },
                set: function (v) {
                    this.originalValue = v;
                },
                enumerable: true
            },
            valueHigh: {
                get: function () {
                    return Math.max(this.originalValue, self.ghost.value);
                },
                set: function (v) {
                    self.ghost.value = v;
                },
                enumerable: true
            }
        });

        if (descriptor.get) {
            Object.defineProperty(this.input, "value", {
                get: function () {
                    return this.valueLow + "," + this.valueHigh;
                },
                set: function (v) {
                    var values = v.split(",");
                    this.valueLow = values[0];
                    this.valueHigh = values[1];
                    this.update();
                },
                enumerable: true
            });
        }

        if (typeof this.input.oninput === "function") {
            this.ghost.oninput = this.input.oninput.bind(this.input);
        }

        /* Handle range with only one value possible */
        if (this.min === this.max) {
            this.ghost.classList.add("reverse");
            this.ghost.style.setProperty("--low", "0%");
            this.ghost.style.setProperty("--high", "100%");
            this.counterInputUpdate();
            return; // No need to continue, there will be no events.
        }

        this.input.addEventListener("input", this.update.bind(this));
        this.ghost.addEventListener("input", this.update.bind(this));

        this.input.addEventListener("touchstart", this.dispatchOldValueEvent.bind(this));
        this.ghost.addEventListener("touchstart", this.dispatchOldValueEvent.bind(this));
        this.input.addEventListener("mousedown", this.dispatchOldValueEvent.bind(this));
        this.ghost.addEventListener("mousedown", this.dispatchOldValueEvent.bind(this));

        this.input.addEventListener("touchend", this.dispatchNewValueEvent.bind(this));
        this.ghost.addEventListener("touchend", this.dispatchNewValueEvent.bind(this));
        this.input.addEventListener("mouseup", this.dispatchNewValueEvent.bind(this));
        this.ghost.addEventListener("mouseup", this.dispatchNewValueEvent.bind(this));

        if (this.counterInput) {
            this.leftCounter.addEventListener("click", this.counterInputSwitch.bind(this));
            this.rightCounter.addEventListener("click", this.counterInputSwitch.bind(this));

            this.leftInput.addEventListener("blur", this.counterInputSwitch.bind(this));
            this.rightInput.addEventListener("blur", this.counterInputSwitch.bind(this));

            this.leftInput.addEventListener("keypress", this.elementBlurOnEnter.bind(this));
            this.rightInput.addEventListener("keypress", this.elementBlurOnEnter.bind(this));

            this.leftInput.addEventListener("focus", this.selectAllFocus.bind(this));
            this.rightInput.addEventListener("focus", this.selectAllFocus.bind(this));
        }
        this.update();
    }

    update() {
		this.ghost.style.setProperty("--low", 100 * ((this.input.valueLow - this.min) / (this.max - this.min)) + "%");
        this.ghost.style.setProperty("--high", 100 * ((this.input.valueHigh - this.min) / (this.max - this.min)) + "%");
        this.counterInputUpdate();
    }

    counterInputUpdate() {
        if (this.counterInput) {
            this.leftCounter.innerHTML = this.formatNumber(this.input.valueLow);
            this.rightCounter.innerHTML = this.formatNumber(this.input.valueHigh);
            this.leftInput.value = this.input.valueLow;
            this.rightInput.value = this.input.valueHigh;
        }
    }

	counterInputSwitch(ev) {
        var counter = this.rightCounter;
        var input = this.rightInput;
        if (ev.currentTarget.classList.contains('multirange-min')) {
            counter = this.leftCounter;
            input = this.leftInput;
        }
        if (counter.style.display === "none") {
            this.input.valueLow = this.leftInput.value;
            this.input.valueHigh = this.rightInput.value;
            this.dispatchNewValueEvent();
            this.update();
            counter.style.display = "";
            input.style.display = "none";
        } else {
            counter.style.display = "none";
            input.style.display = "";
            this.dispatchOldValueEvent();
            // Hack because firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1057858
            window.setTimeout(function () {
                input.focus();
            }, 100);
        }
	}

	elementBlurOnEnter(ev) {
		if (ev.key === "Enter") {
			ev.currentTarget.blur();
		}
	}

	selectAllFocus(ev) {
        ev.currentTarget.select();
    }

    dispatchNewValueEvent() {
        this.input.dispatchEvent(new CustomEvent("newRangeValue", {
            bubbles: true,
        }));
    }

    dispatchOldValueEvent() {
        this.input.dispatchEvent(new CustomEvent("oldRangeValue", {
            bubbles: true,
        }));
    }

    formatNumber(number) {
        number = String(number).split('.');
        var formatedNumber = number[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') + (number[1] ? '.' + number[1] : '');
        if (this.currency.length) {
            if (this.currencyPosition === 'after') {
                formatedNumber = formatedNumber + ' ' + this.currency;
            } else {
                formatedNumber = this.currency + ' ' + formatedNumber;
            }
        }
        return formatedNumber;
    }
}

var supportsMultiple = HTMLInputElement && "valueLow" in HTMLInputElement.prototype;

window.multirange = function (inputs, options) {
    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if (supportsMultiple || input.classList.contains("multirange")) {
            return;
        }
        new Multirange(input, options);
    }
};

window.multirange.init = function () {
	multirange(document.querySelectorAll("input[type=range][multiple]:not(.multirange)"));
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", multirange.init);
} else {
    multirange.init();
}
})();
