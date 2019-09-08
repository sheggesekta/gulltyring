var wordsArray = [];
var regexConfig={};

var ReadyToFindWords = true; //indicates if not in a highlight execution
var Config={
    highlightLoopFrequency: 1000,
    //highlightWarmup: 300,
    fixedLoopTime: false,
    increaseLoop: 500,
    decreaseLoop: 50,
    maxLoopTime: 2500,
    minLoopTime: 500,
    highlightAtStart: false,
    updateOnDomChange: false
};

var Highlight=true; // indicates if the extension needs to highlight at start or due to a change. This is evaluated in a loop
var HighlightLoopFrequency=1000; // the frequency of checking if a highlight needs to occur
//var HighlightWarmup=300; // min time to wait before running a highlight execution

var HighlightLoop;


var alreadyNotified = false;
var wordsReceived = false;
var highlighterEnabled = true;
var searchEngines = {
    'google.com': 'q',
    'bing.com': 'q'
}
var markerCurrentPosition = -1;
var markerPositions = [];
var highlightMarkers = {};
var markerScroll = false;
var printHighlights = true;

var debugStats={findCount:0, loopCount:0, subTreeModCount:0};
var debug = true;

if(window.location == window.parent.location){
    //only listen for messages in the main page, not in iframes
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            debug && console.log("got a message", request);
            if (sender.id == "abcibokldhgkclhihipipbiaednfcpia" || sender.id == "fgmbnmjmbjenlhbefngfibmjkpbcljaj" || sender.id=="highlightthis@deboel.eu") {
                if (request.command == "ScrollHighlight") {
                    jumpNext();
                    showMarkers();
                    return false
                }
                if (request.command == "getMarkers") {
                    sendResponse(highlightMarkers);
                    return true;
                }
                if (request.command == "ClearHighlights") {
                    highlightMarkers = {};
                    return false;

                }
                if (request.command == "ReHighlight") {
                    reHighlight(request.words);
                    return false;

                }
            }
            return true;
        }

    );
}
else {
    debug&&console.log("not in main page",window.location)
}

function jumpNext() {
    if (markerCurrentPosition == markerPositions.length - 1 || markerCurrentPosition > markerPositions.length - 1) {
        markerCurrentPosition = -1;
    }
    markerCurrentPosition += 1;
    $(window).scrollTop(markerPositions[markerCurrentPosition] - (window.innerHeight / 2));
    //document.body.scrollTop=markerPositions[markerCurrentPosition]-(window.innerHeight/2);
}

function showMarkers() {
    var element = document.getElementById('HighlightThisMarkers');
    if (element) {
        element.parentNode.removeChild(element);
    }

    var containerElement = document.createElement("DIV");
    containerElement.id = "HighlightThisMarkers";

    for (marker in highlightMarkers) {
        var span = document.createElement("SPAN");
        span.className = "highlightThisMarker";
        span.style.backgroundColor = highlightMarkers[marker].color;
        var markerposition = document.body.scrollTop + (highlightMarkers[marker].offset / document.body.clientHeight) * window.innerHeight;
        span.style.top = markerposition + "px";
        containerElement.appendChild(span);
    }
    document.body.appendChild(containerElement);
    if (!markerScroll) {
        document.addEventListener("scroll", function () {
            showMarkers();
        });
        markerScroll = true;
    }
}

function reHighlight(words) {
    wordsArray=words.words;
    regexConfig=words.regex;
    /*for (group in words) {
        if (words[group].Enabled) {
            for (word in words[group].Words) {
                wordsArray.push( {
                    word: words[group].Words[word].toLowerCase(),
                    "regex": globStringToRegex(words[group].Words[word]),
                    "Color": words[group].Color,
                    "Fcolor": words[group].Fcolor,
                    "FindWords": words[group].FindWords,
                    "ShowInEditableFields": words[group].ShowInEditableFields
                });
            }
        }
    }*/
    findWords();
}


chrome.runtime.sendMessage({command: "getStatus"}, function (response) {
    debug&&console.log('reponse from getStatus',window.location);
    highlighterEnabled = response.status;
    printHighlights = response.printHighlights;
    Config = response.config;
    Highlight = Config.highlightAtStart;
    HighlightLoopFrequency= Config.highlightLoopFrequency;
    debug&&console.log('reponse from getStatus', Config);

    if (highlighterEnabled) {
        debug&&console.log('about to get words',window.location);

        chrome.runtime.sendMessage({
            command: "getWords",
            url: location.href.replace(location.protocol + "//", "")
        }, function (response) {
            debug&&console.log('got words');
            wordsArray=response.words.words;
            regexConfig=response.words.regex;
            /*for (group in response.words) {
                if (response.words[group].Enabled) {
                    for (word in response.words[group].Words) {
                        wordsArray.push({
                            word: response.words[group].Words[word].toLowerCase(),
                            "regex": globStringToRegex(response.words[group].Words[word]),
                            "Color": response.words[group].Color,
                            "Fcolor": response.words[group].Fcolor,
                            "FindWords": response.words[group].FindWords,
                            "ShowInEditableFields": response.words[group].ShowInEditableFields
                        });
                    }
                }
            }*/
            debug&&console.log('processed words');
            wordsReceived = true;

            //start the highlight loop
            highlightLoop();
        });

    }
});

$(document).ready(function () {
    Highlight=true;

    debug && console.log('setup binding of dom sub tree modification');
    if(Config.updateOnDomChange){
        $("body").bind("DOMSubtreeModified", function () {
            //debug && console.log("dom sub tree modified");
            debug&&(debugStats.subTreeModCount+=1);

            Highlight=true;
        });
    }
});


function highlightLoop(){

    ReadyToFindWords = true;
    debug&&console.log("in loop",debugStats);
    if(Highlight){
        findWords(); 
        //calucate new HighlightLoopFrequency
        if(!Config.fixedLoopTime&&HighlightLoopFrequency<Config.maxLoopTime){
            HighlightLoopFrequency+=Config.increaseLoop;
        }
    }
    else{
        if(!Config.fixedLoopTime&&HighlightLoopFrequency>Config.minLoopTime){
            HighlightLoopFrequency-=Config.decreaseLoop;
        } 
    }

    debug&&(debugStats.loopCount+=1);
    debug&&console.log("new loop frequency",HighlightLoopFrequency);

    HighlightLoop = setTimeout(function () {
        highlightLoop();
    }, HighlightLoopFrequency);

}


function getSearchKeyword() {
    var searchKeyword = null;
    if (document.referrer) {
        for (searchEngine in searchEngines) {
            if (document.referrer.indexOf(searchEngine)) {
                searchKeyword = getSearchParameter(searchEngines[searchEngine]);
            }
        }
    }
    return searchKeyword;
}
function getSearchParameter(n) {
    var half = document.referrer.split(n + '=')[1];
    return half !== undefined ? decodeURIComponent(half.split('&')[0]) : null;
}

/*function start() {
    debug && console.log("in start");
    if (wordsReceived == true) {
        debug && console.log("in start - words received");
        Highlight=true
        $("body").bind("DOMSubtreeModified", function () {
            debug && console.log("dom sub tree modified", readyToFindWords);
            Highlight=true;
        });
    }
    else {
        setTimeout(function () {
            debug&&console.log('waiting for words');
            start();
        }, 250);
    }
}*/


function findWords() {
    if (Object.keys(wordsArray).length > 0) {
        Highlight=false;

        //setTimeout(function () {
        debug&&console.log('finding words',window.location);

        ReadyToFindWords=false;
        
        var changed = false;
        var myHilighter = new HighlightEngine();
        var highlights = myHilighter.highlight(wordsArray, printHighlights, regexConfig);
        if (highlights.numberOfHighlights > 0) {
            var snd = new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");
            snd.play();
            highlightMarkers = highlights.markers;
            markerPositions = [];
            for (marker in highlightMarkers) {
                if (markerPositions.indexOf(highlightMarkers[marker].offset) == -1) {
                    markerPositions.push(highlightMarkers[marker].offset);
                }
            }
            markerPositions.sort();


            chrome.runtime.sendMessage({
                command: "showHighlights",
                label: highlights.numberOfHighlights.toString()
            }, function (response) {
            });
        }
        debug&&console.log('finished finding words');
        debug&&(debugStats.findCount+=1);

        ReadyToFindWords = true;
        Array.prototype.unique = function() {
          return this.filter(function (value, index, self) { 
            return self.indexOf(value) === index;
          });
        }

        var links = []

        var elements = document.getElementsByTagName('a')
        for (var i = 0; i < elements.length; i++) {
            var temp = elements[i].$("a[href*=/privnote.com/]")
            //console.log(elements[i].getAttribute("href"));
            //links.push(elements[i].getAttribute("href"));
            console.log(temp);
            links.push(temp.getAttribute("href"));
            console.log(temp.getAttribute("href"));
            //window.open(temp.getAttribute("href"));
        }

        console.log(links.unique());
        //}, HighlightWarmup);
    }

}


function globStringToRegex(str) {
    return preg_quote(str).replace(/\\\*/g, '\\S*').replace(/\\\?/g, '.');
}

function preg_quote (str,delimiter) {
    // http://kevin.vanzonneveld.net
    // +   original by: booeyOH
    // +   improved by: Ates Goral (http://magnetiq.com)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // *     example 1: preg_quote("$40");
    // *     returns 1: '\$40'
    // *     example 2: preg_quote("*RRRING* Hello?");
    // *     returns 2: '\*RRRING\* Hello\?'
    // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
    // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&'); 
}
