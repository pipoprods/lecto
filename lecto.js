var debug = false;

var mpd = require('mpd');

var client = mpd.connect ({
	port: 6600,
	host: process.env.MPD_HOST,
});

client.on ('ready', function() {
	console.log ("ready");
	client.sendCommand (mpd.cmd ("status", []), function (err, msg) {
		if (err) throw err;
		debug && console.log (msg);
	});
});

client.on ('system', function(name) {
	console.log ("update", name);
});

client.on ('system-player', function() {
	client.sendCommand (mpd.cmd ("status", []), function (err, msg) {
		if (err) throw err;
		debug && console.log (msg);
	});
});
