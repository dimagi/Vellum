// Install word scrambling gettext functions if lang=eglinsh in URL
(function () {
    var placeholder = /^(\{.+?\}|\$\d)$/,
        dictionary = {};

    function typoglyceme(text) {
        var words = text.split(" "),
            info;
        for (var i = words.length - 1; i >= 0; i--) {
            if (!placeholder.test(words[i])) {
                info = depunctuate(words[i]);
                words[i] = scramble(info.word) + info.punctuation;
            }
        }
        var result = words.join(" ");
        if (result === text) {
            result = "^" + result + "$";
        }
        return result;
    }

    function depunctuate(word) {
        var match = /^(.*?)(\W*)$/.exec(word);
        return {
            original: word,
            word: match[1],
            punctuation: match[2],
        };
    }

    function scramble(word) {
        if (!dictionary.hasOwnProperty(word)) {
            var letters = word.split("");
            if (word.length === 2) {
                letters = [word[1], word[0]];
            } else if (word.length === 3 || word.length === 4) {
                letters[1] = word[2];
                letters[2] = word[1];
            } else if (word.length > 4) {
                var middle = shuffle(letters.slice(1, -1)).join("");
                letters.splice(1, word.length - 2, middle);
            }
            dictionary[word] = letters.join("");
        }
        return dictionary[word];
    }

    // https://stackoverflow.com/a/2450976/10840
    function shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }

    if (/[?&]typoglycemia(=true)?(&|#|$)/.test(window.location.href)) {
        window.gettext = typoglyceme;
        window.ngettext = function (singular, plural, count) {
            return count === 1 ? typoglyceme(singular) : typoglyceme(plural);
        };
    }
})();
