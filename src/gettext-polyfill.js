// Polyfill for gettext/ngettext if not provided by the environment
// This module must be imported before any module that uses gettext

if (!window.gettext) {
    window.gettext = function (arg) { return arg; };
    window.ngettext = function (singular, plural, count) {
        return count === 1 ? singular : plural;
    };
}