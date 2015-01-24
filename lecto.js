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


	/***************************************************************
	 * Load mpd module and add some methods
	 ***************************************************************/
	var mpd = require ('mpd');

	// Query current status
	mpd.prototype.queryStatus = function (callback) {
		// Query current status
		this.sendCommand (mpd.cmd ('status', []), function (err, msg) {
			if (err) throw (err);
			debug && console.log ('[queryStatus] ' + msg);
			callback (mpd.parseKeyValueMessage (msg));
		});
	}

	// Query current song information
	mpd.prototype.queryCurrentSong = function (callback) {
		this.sendCommand (mpd.cmd ('currentsong', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[queryCurrentSong] ' + msg);
			callback (mpd.parseKeyValueMessage (msg));
		});
	}


	/***************************************************************
	 * Models and views
	 ***************************************************************/

	// Player view
	var Player = Backbone.View.extend ({
		initialize: function () {
			debug && console.log ('[Player::initialize]');
			this.$el.find ('span.progress').slider ();
		},
		update: function (data) {
			debug && console.log ('[Player::update] data: ');
			debug && console.dir (data);
			if (data.current !== undefined) {
				for (var attr in data.current.attributes) {
					if (attr === 'progress') break;
					this.$el.find ('span.' + attr.toLowerCase ()).html (data.current.get (attr));
				}
				this.$el.find ('span.progress').slider ('value', data.current.get ('progress'));
			}
			if (data.state !== undefined) {
				var classes = ['playpause'];
				switch (data.state.get ('state')) {
					case 'play':
						classes.push ('pause');
						this.show ();
						break;
					case 'pause':
						classes.push ('play');
						this.show ();
						break;
					case 'stop':
						classes.push ('play');
						this.hide ();
						break;
				}
				this.$el.find ('button.playpause').attr ('class', classes.join (' '));
			}
		},
		show: function () {
			this.$el.find ('div.info').fadeIn ();
		},
		hide: function () {
			this.$el.find ('div.info').fadeOut ();
		}
	});

	// Global status
	var Status = Backbone.Model.extend ({
		song: null,
		songid: null,
		nextsong: null,
		nextsongid: null,
		playlist: null,
		playlistlength: null,
		state: null
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
			elapsed: '',
			progress: 0
		},
		initialize: function () {
			this.on ('change:elapsed', function () {
				this.set ('progress', parseInt (this.attributes.elapsed, 10) / parseInt (this.attributes.Time, 10) * 100);
			});
		},
		get: function (attr) {
			if (['elapsed', 'Time'].indexOf (attr) !== -1) {
				return ((this.attributes[attr] !== undefined) ? this.attributes[attr].toHHMMSS () : '');
			}
			return Backbone.Model.prototype.get.call (this, attr);
		}
	});


	/***************************************************************
	 * Startup
	 ***************************************************************/
	$(document).ready (function () {
		// Create the player view
		var player = new Player ({el: $('div.player')});

		// Create current track model
		var current = new Track ({view: player});
		current.on ('change', function () {
			this.get ('view').update ({ current: this });
		});

		// Create status model
		var status = new Status ();
		status.on ('change:state', function () {
			debug && console.log ('[Status:change:state]');
			player.update ({ state: this });
		});

		/*
		 * Initialize MPD connection and callbacks
		 */
		var client = mpd.connect ({
			port: 6600,
			host: process.env.MPD_HOST,
		});

		// Initial status when connection is ready
		client.on ('ready', function() {
			debug && console.log ('ready');
			client.queryStatus (function (data) {
				status.set (data);
			});
			client.queryCurrentSong (function (data) {
				current.set (data);
			});
		});

		// Update status on player change event
		client.on ('system-player', function() {
			client.queryStatus (function (data) {
				status.set (data);
			});
			client.queryCurrentSong (function (data) {
				current.set (data);
			});
		});

		// Update elapsed time every second
		// TODO move this to player change event so that it can be disabled upon playback stop
		setInterval (function () {
			client.queryStatus (function (data) {
				status.set (data);
				current.set ('elapsed', data.elapsed);
			});
		}, 1000);
	});
}) (jQuery);
