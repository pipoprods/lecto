(function ($) {
	var debug = {
		global: false,
		collection: true
	};

	// Switch to fullscreen
	var gui = require('nw.gui');
	var win = gui.Window.get ();
	win.maximize ();

	// Open dev tools if needed
	Object.keys (debug).map (function (key) {
		if (debug[key]) {
			win.showDevTools ();
		}
	});

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
			debug.global && console.log ('[queryStatus] ' + msg);
			callback (mpd.parseKeyValueMessage (msg));
		});
	};

	// Query current song information
	mpd.prototype.queryCurrentSong = function (callback) {
		this.sendCommand (mpd.cmd ('currentsong', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[queryCurrentSong] ' + msg);
			callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.play = function (callback) {
		this.sendCommand (mpd.cmd ('play', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[play] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.pause = function (callback) {
		this.sendCommand (mpd.cmd ('pause', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[pause] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.stop = function (callback) {
		this.sendCommand (mpd.cmd ('stop', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[stop] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.prev = function (callback) {
		this.sendCommand (mpd.cmd ('previous', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[prev] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	mpd.prototype.next = function (callback) {
		this.sendCommand (mpd.cmd ('next', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[next] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	// Seek to percentage of current song
	mpd.prototype.seek = function (index, pos, callback) {
		this.sendCommand (mpd.cmd ('seek', [index, pos]), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[seek] ' + msg);
			if (callback !== undefined) callback (mpd.parseKeyValueMessage (msg));
		});
	};

	// Query collection
	mpd.prototype.list = function (what, filter, callback) {
		var that = this;

		debug.collection && console.log ('[mpd::list] what: ' + what);

		// Handle simple tags (eg "Album") and convert them to an array:
		// 		[Album1, Album2, ...]
		// Handle combined tags (eg "Date - Album") and convert them to a hash of arrays:
		// 		{
		// 			Date1: [Album1, Album2, ...],
		// 			Date2: [Album3, Album4, ...],
		// 			...
		// 		}
		what = what.split (' - ');
		var combined = (what.length > 1) ? true : false;
		var started = 0, ended = 0;
		var func = function (tag, filter, res) {
			var args = filter.slice (0);
			args.unshift (tag);

			debug.collection && console.log ('[mpd::list] list ' + args.join (' '));

			that.sendCommand (mpd.cmd ("list", args), function (err, msg) {
				if (err) throw err;

				// Loop while tags remaining
				if (what.length) {
					msg.split ("\n").map (function (x) { return (x.replace (tag + ': ', '')) }).forEach (function (v) {
						res[v] = [];

						var args = filter.slice (0);
						args.push (tag, v);
						started++;
						func (what[0], args, res[v]);
					});
					what.shift ();
				}
				else {
					// No more tag to scan, push results to current hash key
					msg.split ("\n").map (function (x) { return (x.replace (tag + ': ', '')) }).forEach (function (v) {
						res.push ({label: v, query: v});
					});
					res.pop ();		// MPD sent an extra line
					if ((combined === false) && (callback !== undefined)) callback (res);
					ended++;
				}
			});
		}

		var res = (what.length > 1) ? {} : [];
		func (what.shift (), filter, res);

		// Wait for all queries to finish
		if (combined === true) {
			var i = setInterval (function () {
				if (started === ended) {
					clearInterval (i);

					// "flatten" object to an array
					var data = [];
					Object.keys (res).forEach (function (key, index) {
						for (i=0; i<res[key].length; i++) {
							data.push ({label: key + ' - ' + res[key][i].label, query: res[key][i].label});
						}
					});

					if (callback !== undefined) callback (data);
				}
			}, 500);
		}
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
		initialize: function (callback) {
			var that = this;

			var fs = require('fs');
			fs.readFile (process.env.HOME + '/.lectorc', 'utf8', function (err, data) {
				if (err) {
					// No config file, defaults automatically provided by Backbone model
				}
				else {
					data.split ("\n").forEach (function (line) {
						var entry = line.split ('=');
						if ((entry[0] !== undefined) && (entry[1] !== undefined)) {
							that.set (entry[0].replace (' ', ''), entry[1].replace (' ', ''));
						}
					});
				}

				if (callback !== undefined) callback (that);
			});
		}
	});


	/***************************************************************
	 * Models and views
	 ***************************************************************/

	// Player view
	var Player = Backbone.View.extend ({
		initialize: function (attr) {
			debug.global && console.log ('[Player::initialize]');
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
				debug.global && console.log ('[Player::events] play');
				this.mpc.play ();
			},
			'click button.pause': function () {
				debug.global && console.log ('[Player::events] pause');
				this.mpc.pause ();
			},
			'click button.stop': function () {
				debug.global && console.log ('[Player::events] stop');
				this.mpc.stop ();
			},
			'click button.prev': function () {
				debug.global && console.log ('[Player::events] prev');
				this.mpc.prev ();
			},
			'click button.next': function () {
				debug.global && console.log ('[Player::events] next');
				this.mpc.next ();
			}
		},
		update: function (data) {
			debug.global && console.log ('[Player::update] data: ');
			debug.global && console.dir (data);
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

	// Collection view
	var CollectionNavigator = Backbone.View.extend ({
		initialize: function (attr) {
			debug.collection && console.log ('[CollectionNavigator::initialize]');
			var that = this;

			this.lecto = attr.lecto;

			// UI initialization
			this.accordion = this.$el.find ('div.collection-contents').accordion ({ heightStyle: "fill" });
			this.$el.find ('button.back').click (function () {
				that.model.back ();
			});

			// Update on model change
			this.model.on ('change', function () {
				that.update ();
			});
		},
		events: {
		},
		update: function () {
			var that = this;
			debug.collection && console.log ('[CollectionNavigator::update]');
			debug.collection && console.dir (this.model.get ('data'));

			if (this.model.get ('level') > 0) {
				this.$el.find ('button.back').show ();
			}
			else {
				this.$el.find ('button.back').hide ();
			}

			// Load template matching current collection level and render it
			var id = ((this.model.get ('current') !== undefined) && ($('#collection-' + this.model.get ('current').toLowerCase ().replace (/ /g, '')).length)) ? '#collection-' + this.model.get ('current').toLowerCase ().replace (/ /g, '') : '#collection-generic';
			debug.collection && console.log ("Template id: " + id);
			var template = Handlebars.compile ($(id).html ());
			this.$el.find ('ul.contents').html ($(template ({data: this.model.get ('data')})));

			// Item click handler
			this.$el.find ('ul.contents').find ('li').addClass (this.model.get ('current').toLowerCase ()).click (function () {
				that.model.fetch ($(this).attr ('query'));
			});
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
			else if (attr === 'cover') {
				var path = this.get ('lecto').get ('base_path') + '/' + this.get ('file').replace (/\/[^\/]*$/, '/');

				var fs = require('fs');
				if (fs.existsSync (path + 'front.jpg')) {
					return (path + 'front.jpg');
				}
				else if (fs.existsSync (path + 'front.png')) {
					return (path + 'front.png');
				}
				else return ('images/nocover.jpg');
			}
			return Backbone.Model.prototype.get.call (this, attr);
		},
		seek: function (pos) {
			debug.global && console.log ('[Track::seek] position: ' + pos + ' / ' + this.attributes.Time + ' / ' + this.attributes.Pos);
			this.get ('mpc').seek (this.attributes.Pos, parseInt (parseInt (this.attributes.Time, 10) * pos / 100, 10));
		}
	});

	// The collection
	var Collection = Backbone.Model.extend ({
		current: null,
		defaults: {
			order: ['Genre', 'Artist', 'Date - Album'],
			level: -1,
			history: {
				data:   [],
				filter: []
			}
		},
		initialize: function () {
			var that = this;
			this.set ('filter', new Array ());
			this.get ('mpc').on ('ready', function () {
				that.fetch ();
			});
		},
		get: function (attr) {
			if (attr === 'filter') {
				if (this.attributes[attr] === undefined) {
					this.attributes[attr] = new Array;
				}
			}
			else if ((attr === 'current') && (this.attributes[attr] === undefined)) {
				return ('');
			}
			return Backbone.Model.prototype.get.call (this, attr);
		},
		fetch: function (arg) {
			var that = this;
			// Push arg to filter
			if (arg) {
				this.get ('filter').push (arg);
			}

			debug.collection && console.log ('[Collection::fetch] level: ' + this.get ('level') + ', data: ["' + this.get ('filter').join ('", "') + '"]');
			debug.collection && console.dir (this.get ('filter'));
			debug.collection && console.log ('[Collection::fetch] next: ' + this.get ('order')[this.get ('level')] + ', arg: ' + arg);

			// Fetch collection
			this.get ('mpc').list (this.get ('order')[this.get ('level') + 1], this.get ('filter'), function (data) {
				debug.collection && console.log ('[Collection::fetch] data: ');
				debug.collection && console.dir (data);

				// Keep track of history
				if (that.get ('level') >= 0) {
					that.get ('history').data.push (that.get ('data').slice (0));
					that.get ('history').filter.push (that.get ('filter').slice (0));

					debug.collection && console.log ('[Collection::back] history:');
					debug.collection && console.dir (that.get ('history').filter.slice (0));
					debug.collection && console.dir (that.get ('history').data.slice (0));
				}

				// Update current data
				that.set ('level', that.get ('level') + 1);
				that.get ('filter').push (that.get ('order')[that.get ('level')]);
				that.set ('current', that.get ('order')[that.get ('level')]);
				data.sort (function (a, b) {
					if (a.label < b.label) return -1;
					if (a.label > b.label) return 1;
					return 0;
				});
				that.set ('data', data);
			});
		},
		back: function () {
			debug.collection && console.log ('[Collection::back] filter history:');
			debug.collection && console.dir (this.get ('history').filter.slice (0));
			var filter = this.get ('history').filter.pop ();
			filter.pop (); filter.pop (); filter.push (this.get ('order')[this.get ('level') - 1]);
			this.set ({
				data:    this.get ('history').data.pop (),
				filter:  filter,
				level:   this.get ('level') - 1,
				current: this.get ('order')[this.get ('level') - 1]
			});

			debug.collection && console.log ('[Collection::back] level: ' + this.get ('level') + ' (' + this.get ('order')[this.get ('level')] + ')');
			debug.collection && console.log ('[Collection::back] data:');
			debug.collection && console.dir (this.get ('data').slice (0));
			debug.collection && console.log ('[Collection::back] history:');
			debug.collection && console.dir (this.get ('history').filter.slice (0));
			debug.collection && console.dir (this.get ('history').data.slice (0));
			debug.collection && console.log ('[Collection::back] filter:');
			debug.collection && console.dir (this.get ('filter').slice (0));
		}
	});


	/***************************************************************
	 * Startup
	 ***************************************************************/
	$(document).ready (function () {
		$('body').layout ({
			resizeWhileDragging: true,
			north: {
				resizable: false,
				slidable: false,
				size: 80,
				spacing_open: 0
			},
			west: {
				size: 300
			},
			west__onresize:  $.layout.callbacks.resizePaneAccordions
		});

		/*
		 * Read configuration
		 */
		var conf = new LectoConfiguration (function (lecto) {
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
			var current = new Track ({view: player, mpc: client, lecto: lecto});

			// Create the player view
			var player = new Player ({el: $('div.player'), model: current, mpc: client, lecto: lecto});

			// Create status model
			var status = new Status ();

			// Collection
			var collection = new Collection ({mpc: client, lecto: lecto});
			var colnav = new CollectionNavigator ({el: $('div.collection'), model: collection, lecto: lecto});


			/*
			 * Register model-change events and callbacks
			 */

			// Set window title from currently-played song
			var setWindowAttributes = function (data) {
				if (data.status.get ('state') !== 'stop') {
					win.title = data.current.get ('Title') + ' (' + data.current.get ('Album') + ') - Lecto';
				}
				else {
					win.title = 'Lecto';
				}
			};

			current.on ('change:Title', function () { setWindowAttributes ({current: current, status: status}); });
			current.on ('change:Album', function () { setWindowAttributes ({current: current, status: status}); });

			// Update cover on album change
			current.on ('change:Album', function () {
				$('body').find ('.context img.cover').attr ('src', this.get ('cover'));
			});

			status.on ('change:state', function () {
				debug.global && console.log ('[Status:change:state]');
				player.update ({ state: this });
				setWindowAttributes ({current: current, status: status});
			});


			/*
			 * Register MPD events callbacks
			 */

			// Initial status when connection is ready
			client.on ('ready', function() {
				debug.global && console.log ('ready');
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
	});
}) (jQuery);
