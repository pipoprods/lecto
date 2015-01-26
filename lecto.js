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
	};

	// Query current song information
	mpd.prototype.queryCurrentSong = function (callback) {
		this.sendCommand (mpd.cmd ('currentsong', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[queryCurrentSong] ' + msg);
			callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.play = function (callback) {
		this.sendCommand (mpd.cmd ('play', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[play] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.pause = function (callback) {
		this.sendCommand (mpd.cmd ('pause', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[pause] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.stop = function (callback) {
		this.sendCommand (mpd.cmd ('stop', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[stop] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.prev = function (callback) {
		this.sendCommand (mpd.cmd ('previous', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[prev] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.next = function (callback) {
		this.sendCommand (mpd.cmd ('next', []), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[next] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	// Seek to percentage of current song
	mpd.prototype.seek = function (index, pos, callback) {
		this.sendCommand (mpd.cmd ('seek', [index, pos]), function (err, msg) {
			if (err) throw err;
			debug && console.log ('[seek] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};


	/***************************************************************
	 * Application configuration
	 ***************************************************************/
	var LectoConfiguration = Backbone.Model.extend ({
		base_path: null,
		artist_origin_tag: null,
		empty_tag_string: null,
		lastfm_api_key: null,
		defaults: {
			burn_command: 'cdrdao blank 2>&1 && mp3cd --no-cd-text',
			shutdown_command: 'sudo halt',
			screensaver_command: 'xscreensaver-command'
		},
		initialize: function () {
			var that = this;

			var fs = require('fs');
			fs.readFile (process.env.HOME + '/.lectorc', 'utf8', function (err, data) {
				if (err) {
					// No config file, defaults automatically provided by Backbone model
					return;
				}
				else {
					data.split ("\n").forEach (function (line) {
						var entry = line.split ('=');
						if ((entry[0] !== undefined) && (entry[1] !== undefined)) {
							that.set (entry[0].replace (' ', ''), entry[1].replace (' ', ''));
						}
					});
				}
			});
		}
	});


	/***************************************************************
	 * Models and views
	 ***************************************************************/

	// Player view
	var Player = Backbone.View.extend ({
		initialize: function (attr) {
			debug && console.log ('[Player::initialize]');
			var that = this;
			var $slider = this.$el.find ('span.progress').slider ({
				slide: function (event, ui) {
					that.model.seek (ui.value);
				}
			});
			this.mpc = attr.mpc;
			this.lecto = attr.lecto;

			// Update on model change
			this.model.on ('change', function () {
				that.update ({current: this});
			});
		},
		events: {
			'click button.play': function () {
				debug && console.log ('[Player::events] play');
				this.mpc.play ();
			},
			'click button.pause': function () {
				debug && console.log ('[Player::events] pause');
				this.mpc.pause ();
			},
			'click button.stop': function () {
				debug && console.log ('[Player::events] stop');
				this.mpc.stop ();
			},
			'click button.prev': function () {
				debug && console.log ('[Player::events] prev');
				this.mpc.prev ();
			},
			'click button.next': function () {
				debug && console.log ('[Player::events] next');
				this.mpc.next ();
			}
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
		state: null,
		mpc: null
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
		},
		seek: function (pos) {
			debug && console.log ('[Track::seek] position: ' + pos + ' / ' + this.attributes.Time + ' / ' + this.attributes.Pos);
			this.get ('mpc').seek (this.attributes.Pos, parseInt (parseInt (this.attributes.Time, 10) * pos / 100, 10));
		}
	});


	/***************************************************************
	 * Startup
	 ***************************************************************/
	$(document).ready (function () {
		/*
		 * Read configuration
		 */
		var conf = new LectoConfiguration ();


		/*
		 * Initialize MPD connection and callbacks
		 */
		var client = mpd.connect ({
			port: 6600,
			host: process.env.MPD_HOST,
		});


		/*
		 * Create views and models
		 */

		// Create current track model
		var current = new Track ({view: player, mpc: client});

		// Create the player view
		var player = new Player ({el: $('div.player'), model: current, mpc: client, lecto: conf});

		// Create status model
		var status = new Status ();
		status.on ('change:state', function () {
			debug && console.log ('[Status:change:state]');
			player.update ({ state: this });
		});


		/*
		 * Register MPD events callbacks
		 */

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
