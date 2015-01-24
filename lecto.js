(function ($) {
	var debug = true;

	// Time formater
	String.prototype.toHHMMSS = function () {
		var sec_num = parseInt (this, 10); // don't forget the second param
		var hours   = Math.floor (sec_num / 3600);
		var minutes = Math.floor ((sec_num - (hours * 3600)) / 60);
		var seconds = sec_num - (hours * 3600) - (minutes * 60);

		if (hours   < 10) {hours   = "0"+hours;}
		if (minutes < 10) {minutes = "0"+minutes;}
		if (seconds < 10) {seconds = "0"+seconds;}
		var time    = '' + (hours !== '00' ? (hours+':') : '') +minutes+':'+seconds;
		return (time);
	}

	var mpd = require ('mpd');

	// Player view
	var Player = Backbone.View.extend ({
		initialize: function () {
			debug && console.log ('[Player::initialize]');
		},
		render: function (model, attr) {
			debug && console.log ('[Player::render] attribute: ' + ((attr !== undefined) ? attr : '--'));
			if (attr === undefined) {
				for (var attr in model.attributes) {
					this.$el.find ('span.' + attr.toLowerCase ()).html (model.get (attr));
				}
			}
			else {
				this.$el.find ('span.' + attr.toLowerCase ()).html (model.get (attr));
			}
		}
	});

	// A track (played or not)
	var Track = Backbone.Model.extend ({
		defaults: {
			Title: '',
			Album: '',
			Artist: '',
			Date: '',
			Genre: '',
			Track: '',
			Time: '',
			elapsed: ''
		},
		initialize: function () {
			debug && console.log ('[CurrentTrack::initialize]');
		},
		update: function (data, elapsed_only) {
			debug && console.log ('[CurrentTrack::update] Data:');
			debug && console.dir (data);
			for (var attr in this.attributes) {
				if (data[attr] !== undefined) {
					this.set (attr, data[attr]);
				}
			}
		},
		get: function (attr) {
			if (['elapsed', 'Time'].indexOf (attr) !== -1) {
				return ((this.attributes[attr] !== undefined) ? this.attributes[attr].toHHMMSS () : '');
			}
			return Backbone.Model.prototype.get.call (this, attr);
		}
	});

	// This is where everything starts
	$(document).ready (function () {
		// Create the player view
		var player = new Player ({el: $('div.player')});

		// Create current track model
		var current = new Track ({view: player});
		current.on ('change', function () {
			this.get ('view').render (this);
		});

		/***************************************************************
		 * Initialize MPD connection and callbacks
		 ***************************************************************/
		var client = mpd.connect ({
			port: 6600,
			host: process.env.MPD_HOST,
		});

		// Initial status when connection is ready
		client.on ('ready', function() {
			debug && console.log ('ready');
			client.sendCommand (mpd.cmd ('currentsong', []), function (err, msg) {
				if (err) throw err;
				debug && console.log (msg);
				current.update (mpd.parseKeyValueMessage (msg));
			});
		});

		// Update status on player change event
		client.on ('system-player', function() {
			client.sendCommand (mpd.cmd ('currentsong', []), function (err, msg) {
				if (err) throw err;
				debug && console.log (msg);
				current.update (mpd.parseKeyValueMessage (msg));
			});
		});

		// Update elapsed time every second
		// TODO move this to player change event so that it can be disabled upon playback stop
		setInterval (function () {
			client.sendCommand (mpd.cmd ('status', []), function (err, msg) {
				current.set ('elapsed', mpd.parseKeyValueMessage (msg).elapsed);
			});
		}, 1000);
	});
}) (jQuery);
