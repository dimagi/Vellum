SaveButton = {
    /*
        options: {
            save: "Function to call when the user clicks Save",
            unsavedMessage: "Message to display when there are unsaved changes and the user leaves the page"
        }
    */
    init: function (options) {
        var button = {
            $save: $('<span/>').text(COMMCAREHQ.SaveButton.message.SAVE).click(function () {
                button.fire('save');
            }).button(),
            $retry: $('<span/>').text(COMMCAREHQ.SaveButton.message.RETRY).click(function () {
                button.fire('save');
            }).button(),
            $saving: $('<span/>').text(COMMCAREHQ.SaveButton.message.SAVING).button().button('disable'),
            $saved: $('<span/>').text(COMMCAREHQ.SaveButton.message.SAVED).button().button('disable'),
            ui: $('<div/>').css({textAlign: 'right'}),
            setStateWhenReady: function (state) {
                if (this.state === 'saving') {
                    this.nextState = state;
                } else {
                    this.setState(state);
                }
            },
            setState: function (state) {
                if (this.state === state) {
                    return;
                }
                this.state = state;
                this.$save.detach();
                this.$saving.detach();
                this.$saved.detach();
                this.$retry.detach();
                if (state === 'save') {
                    this.ui.append(this.$save);
                } else if (state === 'saving') {
                    this.ui.append(this.$saving);
                } else if (state === 'saved') {
                    this.ui.append(this.$saved);
                } else if (state === 'retry') {
                    this.ui.append(this.$retry);
                }
            },
            ajax: function (options) {
                var beforeSend = options.beforeSend || function () {},
                    success = options.success || function () {},
                    error = options.error || function () {},
                    that = this;
                options.beforeSend = function () {
                    that.setState('saving');
                    that.nextState = 'saved';
                    beforeSend.apply(this, arguments);
                };
                options.success = function (data) {
                    that.setState(that.nextState);
                    success.apply(this, arguments);
                };
                options.error = function (data) {
                    that.nextState = null;
                    that.setState('retry');
                    alert(COMMCAREHQ.SaveButton.message.ERROR_SAVING);
                    error.apply(this, arguments);
                };
                $.ajax(options);
            }
        };
        eventize(button);
        button.setState('saved');
        button.on('change', function () {
            this.setStateWhenReady('save');
        });
        if (options.save) {
            button.on('save', options.save);
        }
        $(window).bind('beforeunload', function () {
            if (button.state !== 'saved') {
                return options.unsavedMessage || "";
            }
        });
        return button;
    },
    initForm: function ($form, options) {
        var url = $form.attr('action'),
            button = COMMCAREHQ.SaveButton.init({
                unsavedMessage: options.unsavedMessage,
                save: function () {
                    this.ajax({
                        url: url,
                        type: 'POST',
                        dataType: 'json',
                        data: $form.serialize(),
                        success: options.success
                    });
                }
            }),
            fireChange = function () {
                button.fire('change');
            };
        $form.find('*').change(fireChange);
        $form.find('input, textarea').bind('textchange', fireChange);
        return button;
    },
    message: {
        SAVE: 'Save',
        SAVING: 'Saving...',
        SAVED: 'Saved',
        RETRY: 'Try Again',
        ERROR_SAVING: 'There was an error saving'
    }
};
