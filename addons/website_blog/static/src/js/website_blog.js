odoo.define('website_blog.website_blog', function (require) {
'use strict';

var publicWidget = require('web.public.widget');

publicWidget.registry.websiteBlog = publicWidget.Widget.extend({
    selector: '.website_blog',
    events: {
        'click #o_wblog_next_container': '_onNextBlogClick',
        'click a[href^="#o_wblog_post_content"]': '_onContentAnchorClick',
    },

    /**
     * @override
     */
    start: function () {
        $('.js_tweet, .js_comment').share({});
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onNextBlogClick: function (ev) {
        ev.preventDefault();
        var self = this;
        var $el = $(ev.currentTarget);
        var nexInfo = $el.find('#o_wblog_next_post_info').data();

        $el.css('height', $(window).height())
           .find('.o_blog_cover_container').addClass(nexInfo.size + ' ' + nexInfo.text).end()
           .find('.o_wblog_toggle').toggleClass('d-none d-flex');

        // Use setTimeout to compute $el.offset() only after that size classes
        // has been applyed
        setTimeout(function() {
            $('html, body').animate({
                scrollTop: $el.offset().top - self._computeNavHeight(),
            }, 300, 'swing', function () {
                window.location.href = nexInfo.url;
            });
        },0);
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onContentAnchorClick: function (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var $target = $(ev.currentTarget.hash);
        var self = this;

        $('html, body').stop().animate({
            scrollTop: $target.offset().top - self._computeNavHeight(true)
        }, 500, 'swing', function () {
            window.location.hash = 'blog_content';
        });
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onShareArticle: function (ev) {
        var url = '';
        ev.preventDefault();
        var $element = $(ev.currentTarget);
        if ($element.is('*[class*="_complete"]')) {
            var blogTitleComplete = $('#blog_post_name').html() || '';
            if ($element.hasClass('o_twitter_complete')) {
                url = 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=Amazing blog article : ' + blogTitleComplete + "! Check it live: " + window.location.href;
            } else if ($element.hasClass('o_facebook_complete')) {
                url = 'https://www.facebook.com/sharer/sharer.php?u=' + window.location.href;
            } else if ($element.hasClass('o_linkedin_complete')) {
                url = 'https://www.linkedin.com/shareArticle?mini=true&url=' + window.location.href + '&title=' + blogTitleComplete;
            } else {
                url = 'https://plus.google.com/share?url=' + window.location.href;
            }
        } else {
            var blogPost = $element.parents('[name="blog_post"]');
            var blogPostTitle = blogPost.find('.o_blog_post_title').html() || '';
            var blogArticleLink = blogPost.find('.o_blog_post_title').parent('a').attr('href');
            if ($element.hasClass('o_twitter')) {
                url = 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=Amazing blog article : ' + blogPostTitle + "! " + window.location.host + blogArticleLink;
            } else if ($element.hasClass('o_facebook')) {
                url = 'https://www.facebook.com/sharer/sharer.php?u=' + window.location.host + blogArticleLink;
            } else if ($element.hasClass('o_linkedin')) {
                url = 'https://www.linkedin.com/shareArticle?mini=true&url=' + window.location.host + blogArticleLink + '&title=' + blogPostTitle;
            } else if ($element.hasClass('o_google')) {
                url = 'https://plus.google.com/share?url=' + window.location.host + blogArticleLink;
            }
        }
        window.open(url, '', 'menubar=no, width=500, height=400');
    },

    //--------------------------------------------------------------------------
    // Utils
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Boolean} compensateAffix if set to true, double the nav height
     *                  value to compensate the affix effect
     */
    _computeNavHeight: function (compensateAffix) {
        var $mainNav = $('#wrapwrap > header > nav');
        var gap = $mainNav.height() * (compensateAffix ? 2 : 1);
        gap = gap + $mainNav.offset().top;

        return gap;
    },
});
});
