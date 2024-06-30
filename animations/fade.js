// fade.js
module.exports = function(duration) {
    return `fade=in:0:${duration*5},fade=out:${duration*20}:${duration*5}`;
};

// Similarly for other animation files...