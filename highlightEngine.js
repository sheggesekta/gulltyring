function HighlightEngine() {

    var highlightTag = "EM";
    var highlightClassname = "Highlight";
    var skipTags = new RegExp("^(?:SCRIPT|HEAD|NOSCRIPT|STYLE|TEXTAREA)$");
	var skipClasses = new RegExp("(ui-datepicker)",'gi');
    var wordColor = [];
    var matchRegex = "";
    var matchRegexEditable = "";
    var numberOfHighlights = 0; 
    var highlights = {}; 
    var highlightMarkers = {};


    // recursively apply word highlighting
    this.highlightWords = function (node, printHighlights, inContentEditable) {

        if (node == undefined || !node) return;
        if (skipTags.test(node.nodeName)||skipClasses.test(node.className)) return;

        if (node.hasChildNodes()) {
            for (var i = 0; i < node.childNodes.length; i++) {
                this.highlightWords(node.childNodes[i], printHighlights, inContentEditable || node.isContentEditable)
            }
        }

        if (node.nodeType == 3) {
            //only act on text nodes
            var nv = node.nodeValue;
            if(inContentEditable) {regs = matchRegexEditable.exec(nv);} else {regs = matchRegex.exec(nv);}
            if (regs) {
                var wordfound = "";

                //find back the longest word that matches the found word 
                //TODO: this can be faster
                for (word in wordColor) {
                    var pattern = new RegExp(wordColor[word].regex, "i");
                    if (pattern.test(regs[0]) && word.length > wordfound.length) {
                        wordfound = word;
                        break;
                    }
                }

                if (wordColor[wordfound] != undefined) {

                    if ((node.parentElement.tagName == highlightTag && node.parentElement.className == highlightClassname)) {
                        //skip highlighting cause it is already highlighted
                    }
                    else {
                        var match = document.createElement(highlightTag);
                        match.className = highlightClassname;
                        match.appendChild(document.createTextNode(regs[0]));
                        if (printHighlights) {
                            match.style = "padding: 1px;box-shadow: 1px 1px #e5e5e5;border-radius: 3px;-webkit-print-color-adjust:exact;";
                        }
                        else {
                            match.style = "padding: 1px;box-shadow: 1px 1px #e5e5e5;border-radius: 3px;";
                        }

                        if (wordColor[wordfound].Color) {
                            match.style.backgroundColor = wordColor[wordfound].Color;
                        }
                        if (wordColor[wordfound].Fcolor) {
                            match.style.color = wordColor[wordfound].Fcolor;
                        }

                        match.style.fontStyle = "inherit";

                        if (!inContentEditable || (inContentEditable && wordColor[wordfound].ShowInEditableFields)) {
                            var after = node.splitText(regs.index);
                            after.nodeValue = after.nodeValue.substring(regs[0].length);

                            node.parentNode.insertBefore(match, after);
                        }
                    }

                        var nodeAttributes = this.findNodeAttributes(node.parentElement, {
                            "offset": 0,
                            "isInHidden": false
                        });

                        highlightMarkers[numberOfHighlights] = {
                            "word": wordColor[wordfound].word,
                            "offset": nodeAttributes.offset,
                            "hidden": nodeAttributes.isInHidden,
                            "color": wordColor[wordfound].Color
                        };

                        numberOfHighlights += 1;
                        highlights[wordfound] = highlights[wordfound] + 1 || 1;
                }
            }
        }
    };

    this.findNodeAttributes = function (inNode, attributes) {
        attributes.offset += inNode.offsetTop;
        if (inNode.hidden || inNode.getAttribute("aria-hidden")) {
            attributes.isInHidden = true;
        }
        if (inNode.offsetParent) {
            return this.findNodeAttributes(inNode.offsetParent, attributes);

        }
        return attributes;
    }

    // start highlighting at target node
    this.highlight = function (words, printHighlights, regexConfig) {
        wordColor = words;
        numberOfHighlights = 0;
        
        matchRegex = new RegExp(regexConfig.matchRegex, "i");
        matchRegexEditable = new RegExp(regexConfig.matchRegexEditable, "i");
 
        if (matchRegex||matchRegexEditable) {
            this.highlightWords(document.body, printHighlights, false);
        }  
        return {numberOfHighlights: numberOfHighlights, details: highlights, markers: highlightMarkers};
    };

}
