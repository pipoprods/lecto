(function ($) {
	var debug = {
		global: false,
		collection: false,
		playlist: false,
		wp: false
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

	// Register formater taking a number of seconds and returning a formated mm:ss string
	Handlebars.registerHelper('formatTime', function (val) {
		var format = (parseInt (val, 10) >= 3600) ? 'HH:mm:ss' : 'mm:ss';
		return ((new Date).clearTime ().addSeconds (val).toString (format));
	});


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

		// Push all filter elements to args array.
		// Filter elements may be combined (array of arrays), args array must be flattened
		var args = [ what ];
		filter.forEach (function (elem) {
			if (typeof (elem) === 'string') {
				args.push (elem);
			}
			else {
				elem.forEach (function (elem2) {
					args.push (elem2);
				});
			}
		});

		debug.collection && console.log ('[mpd::list] list ' + args.join (' '));

		that.sendCommand (mpd.cmd ("list", args), function (err, msg) {
			if (err) throw err;
			var data = mpd.parseArrayMessage (msg).sort ();
			if (callback !== undefined) callback (data);
		});
	};

	// Query collection with details
	mpd.prototype.find = function (filter, callback) {
		var that = this;

		// Push all filter elements to args array.
		// Filter elements may be combined (array of arrays), args array must be flattened
		var args = [ ];
		filter.forEach (function (elem) {
			if (typeof (elem) === 'string') {
				args.push (elem);
			}
			else {
				elem.forEach (function (elem2) {
					args.push (elem2);
				});
			}
		});

		debug.collection && console.log ('[mpd::find] find ' + args.join (' '));

		that.sendCommand (mpd.cmd ("find", args), function (err, msg) {
			if (err) throw err;
			if (callback !== undefined) callback (mpd.parseArrayMessage (msg));
		});
	};

	// Get playlist contents
	mpd.prototype.playlistinfo = function (callback) {
		this.sendCommand (mpd.cmd ('playlistinfo', []), function (err, msg) {
			if (err) throw err;
			debug.playlist && console.log ('[playlistinfo] ' + msg);
			if (callback !== undefined) callback ((msg !== '') ? mpd.parseArrayMessage (msg) : []);
		});
	};

	// Clear playlist contents
	mpd.prototype.clear = function (callback) {
		this.sendCommand (mpd.cmd ('clear', []), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[clear] ' + msg);
			if (callback !== undefined) callback (mpd.parseArrayMessage (msg));
		});
	};

	// Add to playlist
	mpd.prototype.playlist_add = function (file, callback) {
		this.sendCommand (mpd.cmd ('add', [file]), function (err, msg) {
			if (err) throw err;
			debug.global && console.log ('[add] ' + msg);
			if (callback !== undefined) callback (mpd.parseArrayMessage (msg));
		});
	};

	// Update collection
	mpd.prototype.update = function () {
		this.sendCommand (mpd.cmd ('update', []));
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

			// Select accordion pane matching collection level
			that.accordion = that.$el.find ('div.collection-contents').accordion ({ heightStyle: "fill", active: that.model.get ('level') });
			this.model.on ('change:level', function () {
				that.accordion = that.$el.find ('div.collection-contents').accordion ({ heightStyle: "fill", active: that.model.get ('level') });
			});

			// Pop collection level on tab click
			this.$el.find ('h3.ui-accordion-header').click (function () {
				that.model.jump ($(this).attr ('tag'));
			});

			this.model.on ('change:data', function () {
				that.update ();
			});

			this.$el.find ('button.playlist-add').click (function () {
				debug.collection && console.log ('[CollectionNavigator::playlist-add-click]');
				var paths = that.model.get ('data').map (function (entry) {
					return (entry.track.get ('file'));
				});
				debug.collection && console.dir (paths);
				that.model.add (paths);
			});
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
			this.$el.find ('div.' + this.model.get ('current').toLowerCase () + ' ul.contents').html ($(template ({data: this.model.get ('data')})));

			// Item click handler
			this.$el.find ('div.' + this.model.get ('current').toLowerCase ()).siblings ('div').find ('ul.contents').find ('li').off ('click').click (function () {
				that.model.push ($(this).attr ('query'));
			});
			this.$el.find ('div.' + this.model.get ('current').toLowerCase () + ' ul.contents').find ('li').addClass (this.model.get ('current').toLowerCase ()).click (function () {
				that.model.push ($(this).attr ('query'));
			});
		}
	});

	// Playlist view
	var PlaylistView = Backbone.View.extend ({
		initialize: function (attr) {
			debug.playlist && console.log ('[PlaylistView::initialize]');
			var that = this;

			this.lecto  = attr.lecto;
			this.status = attr.status;

			this.model.on ('change:data', function () {
				that.update ();
			});

			this.model.on ('change:duration', function () {
				var format = (that.model.get ('duration') >= 3600) ? 'HH:mm:ss' : 'mm:ss';
				that.$el.find ('span.playlist-duration span.duration').html ((new Date).clearTime ().addSeconds (that.model.get ('duration')).toString (format));
			});

			this.status.on ('change:song', function () {
				that.set_current ();
			});

			this.status.on ('change:playlist', function () {
				that.model.fetch ();
			});

			this.$el.find ('button.clear-playlist').click (function () {
				that.model.clear ();
			});
		},
		update: function () {
			var that = this;
			debug.playlist && console.log ('[PlaylistView::update]');
			debug.playlist && console.dir (this.model.get ('data'));

			var template = Handlebars.compile ($('#playlist-entry').html ());
			this.$el.find ('table tbody').html ($(template ({data: this.model.get ('data')})));

			this.set_current ();
		},
		set_current: function () {
			this.$el.find ('tr').removeClass ('current');
			if (this.status.get ('song') !== undefined) {
				this.$el.find ('table tbody tr:nth-child(' + (parseInt (this.status.get ('song'), 10) + 1) + ')').addClass ('current');
			}
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
			level: 1,
			order: ['Genre', 'Artist', 'Album', 'Title'],
			conf: {
				Genre:  {
				},
				Artist: {
				},
				Album:  {
					prefix: 'Date',
					fields: ['cover']
				},
				Title:  {
					prefix: 'Track',
					suffix: 'Comment'
				}
			},
			select:   [ ],	// Arguments for each collection level (see 'order' above)
			contents: [ ],	// Collection contents (yet loaded) one array per collection level (see 'order' above)
			data:     [ ]	// Current level data (to be monitored and displayed)
		},
		initialize: function (attr) {
			var that = this;

			this.lecto = attr.lecto;

			// Push empty data for fields before initial one (eg starting at 'Artist' level instead of 'Genre')
			for (i=0; i<this.get ('level'); i++) {
				this.get ('select').push (undefined);
				this.get ('contents').push ([]);
			}

			this.get ('mpc').on ('ready', function () {
				that.fetch ();
			});

			this.on ('change:level', this.fetch);
		},
		get: function (attr) {
			if (attr === 'filter') {
				debug.collection && console.log ('[Collection::get] select: ' + this.get ('select').join (' -- '));

				// Compute filter from level, selection and data
				var filter = [ ];
				for (i=0; i<this.get ('level'); i++) {
					if (this.get ('select')[i] !== undefined) {
						filter.push (this.get ('order')[i]);
						filter.push (this.get ('select')[i]);
					}
				}

				debug.collection && console.log ('[Collection::get] filter: ' + filter.join (' -- '));
				return (filter);
			}
			else if (attr === 'current') {
				return (this.get ('order')[this.get ('level')]);
			}
			return Backbone.Model.prototype.get.call (this, attr);
		},
		fetch: function () {
			var that = this;

			debug.collection && console.log ('[Collection::fetch] level: ' + this.get ('level') + ', data: ["' + this.get ('filter').join ('", "') + '"]');
			debug.collection && console.dir (this.get ('filter'));

			// Fetch collection
			if ((this.get ('conf')[this.get ('current')].prefix !== undefined) || (this.get ('conf')[this.get ('current')].suffix !== undefined)) {
				this.get ('mpc').find (this.get ('filter'), function (raw) {
					raw.sort (function (a, b) {
						if (   (a[that.get ('conf')[that.get ('current')].prefix] + a[that.get ('conf')[that.get ('current')].suffix] + a[that.get ('current')])
						     < (b[that.get ('conf')[that.get ('current')].prefix] + b[that.get ('conf')[that.get ('current')].suffix] + b[that.get ('current')])   )
						  	return -1;

						if (   (a[that.get ('conf')[that.get ('current')].prefix] + a[that.get ('conf')[that.get ('current')].suffix] + a[that.get ('current')])
						     > (b[that.get ('conf')[that.get ('current')].prefix] + b[that.get ('conf')[that.get ('current')].suffix] + b[that.get ('current')])   )
						  	return 1;

						return 0;
					});
					var data = _.uniq (raw, function (entry) { return (entry[that.get ('conf')[that.get ('current')].prefix] + entry[that.get ('conf')[that.get ('current')].suffix] + entry[that.get ('current')]); });

					var data = data.map (function (entry) {
						var desc = {
							prefix: entry[that.get ('conf')[that.get ('current')].prefix],
							suffix: entry[that.get ('conf')[that.get ('current')].suffix],
							label:  entry[that.get ('current')],
							tag:    that.get ('current'),
							query:  entry[that.get ('current')] + '~~query-sep~~' + that.get ('conf')[that.get ('current')].prefix + '~~query-sep~~' + entry[that.get ('conf')[that.get ('current')].prefix]
						};
						desc.track = new Track ({lecto: that.lecto});
						desc.track.set (entry);
						if (that.get ('conf')[that.get ('current')].fields) {
							that.get ('conf')[that.get ('current')].fields.forEach (function (field) {
								desc[field] = desc.track.get (field);
							});
						}
						return (desc);
					});

					debug.collection && console.log ('[Collection::fetch] data: ');
					debug.collection && console.dir (data);

					// Update current data
					that.get ('contents').push (data);
					that.set ('data', data);
				});
			}
			else {
				this.get ('mpc').list (this.get ('order')[this.get ('level')], this.get ('filter'), function (raw) {
					raw.sort (function (a, b) {
						if (a[that.get ('current')] < b[that.get ('current')]) return -1;
						if (a[that.get ('current')] > b[that.get ('current')]) return 1;
						return 0;
					});
					var data = raw.map (function (entry) {
						return ({
							label: entry[that.get ('current')],
							tag:   that.get ('current'),
							query: entry[that.get ('current')],
							class: (entry[that.get ('current')] === '') ? 'empty' : ''
						});
					});

					debug.collection && console.log ('[Collection::fetch] data: ');
					debug.collection && console.dir (data);

					// Update current data
					that.get ('contents').push (data);
					that.set ('data', data);
				});
			}
		},
		push: function (value) {
			debug.collection && console.log ('[Collection::push] value: ' + value);
			var parts = value.split ('~~query-sep~~');
			this.get ('select').push (parts);
			this.set ('level', this.get ('level') + 1);
		},
		jump: function (tag) {
			debug.collection && console.log ('[Collection::jump] current level: ' + this.get ('level') + ' (' + this.get ('order')[this.get ('level')] + ')');

			if (this.get ('order').indexOf (tag) < this.get ('level')) {
				// Tag to jump to is placed before current one, go back
				this.get ('select').splice (this.get ('order').indexOf (tag), this.get ('select').length);
				this.get ('contents').splice (this.get ('order').indexOf (tag), this.get ('select').length);
			}

			this.set ('level', this.get ('order').indexOf (tag));
			debug.collection && console.log ('[Collection::jump] new level: ' + this.get ('level') + ' (' + this.get ('order')[this.get ('level')] + '), select: ' + this.get ('select').join (' -- '));
			if (this.get ('contents')[this.get ('order').indexOf (tag)].length) {
				this.set ('data', this.get ('contents')[this.get ('order').indexOf (tag)]);
			}
			else {
				this.fetch ();
			}
		},
		add: function (files) {
			var that = this;
			files.forEach (function (file) {
				that.get ('mpc').playlist_add (file);
			});
		}
	});

	// The playlist
	var Playlist = Backbone.Model.extend ({
		duration: undefined,
		defaults: {
			data: [ ]
		},
		initialize: function (attr) {
			var that = this;

			this.lecto = attr.lecto;
			this.mpc   = attr.mpc;

			this.get ('mpc').on ('ready', function () {
				that.fetch ();
			});
		},
		fetch: function () {
			var that = this;

			debug.playlist && console.log ('[Playlist::fetch]');
			this.get ('mpc').playlistinfo (function (data) {
				debug.playlist && console.log ('[Playlist::fetch] data: ');
				debug.playlist && console.dir (data);

				// Sum track lengths
				var duration = data.map (function (item) {
					return (parseInt (item.Time, 10));
				}).reduce(function (a, b) { return a + b; }, 0);

				// Update current data
				that.set ({
					data: data,
					duration: duration
				});
			});
		},
		clear: function () {
			debug.playlist && console.log ('[Playlist::clear]');
			this.get ('mpc').clear ();
		}
	});

	// A biography on Wikipedia
	var WPPage = Backbone.Model.extend ({
		url: undefined,
		initialize: function (attr) {
			var that = this;

			this.lecto   = attr.lecto;
			this.current = attr.current;

			this.lang    = (this.get ('lecto').get ('wp_lang') !== undefined) ? this.get ('lecto').get ('wp_lang') : 'en';

			this.current.on ('change:Artist', function () {
				that.fetch ();
			});
		},
		fetch: function () {
			var that = this;

			debug.wp && console.log ('[WPPage::fetch] ' + that.current.get ('Artist'));

			$.get ('https://' + this.lang + '.wikipedia.org/w/api.php?action=opensearch&namespace=0&limit=1000&format=json&search=' + this.current.get ('Artist'), function (data) {
				debug.wp && console.log ('[WPPage::fetch] Existing pages: ');
				debug.wp && console.dir (data[1]);
				var page = that.current.get ('Artist');
				if (that.lecto.get ('wp_categories')) {
					that.lecto.get ('wp_categories').split (',').forEach (function (cat) {
						if (data[1].indexOf (that.current.get ('Artist') + ' (' + cat + ')') >= 0) {
							page = that.current.get ('Artist') + ' (' + cat + ')';
						}
					});
				}

				debug.wp && console.log ('[WPPage::fetch] Selected page: ' + page);
				that.set ('url', 'https://' + that.lang + '.wikipedia.org/wiki/' + page);
			});
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

		$('div.context').layout ({
			west: {
				resizable: false,
				slidable: false,
				spacing_open: 0,
				size: 435
			}
		});

		$('div.tabs').tabs ();

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

			// Playlist
			var playlist = new Playlist ({mpc: client, lecto: lecto});
			var pls = new PlaylistView ({el: $('#playlist'), model: playlist, lecto: lecto, status: status});

			// WP Page
			var wp = new WPPage ({current: current, lecto: lecto});
			wp.on ('change:url', function () {
				$('#biography iframe').attr ('src', wp.get ('url'));
				if (wp.get ('url') !== 'about:blank') {
					$('a[href=#biography]').click ();
				}
			});
			$('#biography div.navigation button.back').click (function () {
				biography.history.back ();
			});


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

			// File information
			current.on ('change:file', function () {
				$('span.filetype').html (current.get ('file').substr (current.get ('file').lastIndexOf('.') + 1).toUpperCase ());
			});
			status.on ('change:bitrate', function () {
				$('span.bitrate').html (status.get ('bitrate') + "kbps");
			});
			status.on ('change:state', function () {
				if (status.get ('state') !== 'stop') {
					$('span.file-properties').slideDown ();
				}
				else {
					$('span.file-properties').slideUp ();
				}
			});

			// Monitor playlist changes and start playback
			playlist.on ('change', function () {
				if (status.get ('state') === 'stop') {
					client.play ();
				}
			});


			// Collection update button
			$('button.collection-update').click (function () {
				client.update ();
			});
			status.on ('change:updating_db', function () {
				if (status.get ('updating_db') !== undefined) {
					$('button.collection-update').addClass ('active');
				}
				else {
					$('button.collection-update').removeClass ('active');
				}
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
				status.on ('change:state', function () {
					if (status.get ('state') !== 'stop') {
						client.queryCurrentSong (function (data) {
							current.set (data);
						});
					}
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
