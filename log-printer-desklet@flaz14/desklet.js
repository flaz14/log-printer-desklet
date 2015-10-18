const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;

const PIXELS_PER_SYMBOL_HORIZONTAL = 8.4;
const PIXELS_PER_SYMBOL_VERTICAL = 17.1;

const CHECKBOX_HANDLE_PREFIX = "_onUseRegexFilter";
const CHECKBOX_HANDLE_SUFFIX = "Change";
const ENTRY_HANDLE_PREFIX = "_onRegexPattern";
const ENTRY_HANDLE_SUFFIX = "Change";

const MAX_REGEX_PATTERNS = 5;

// Text labels on UI elements
const LABELS = {
	"WALLPAPER_MODE_ON":     "          Wallpaper Mode: ON ⚓",
	"WALLPAPER_MODE_OFF":    "          Wallpaper Mode: OFF",
	"FILTERS_IN_USE_PREFIX": " ",   
	"FILTERS_IN_USE_SUFFIX": "𐏑" 	// 𐏑 - looks like a funnel when font size is huge
};

// Names of options (corresponding to settings-schema.json)
const OPTIONS = {
	"DESKLET_WIDTH":           "deskletWidth",
	"DESKLET_HEIGHT":          "deskletHeight",
	"HEADER_COLOR":            "headerColor",
	"FILE_TO_TRACK":           "fileToTrack",
	"TEXT_COLOR":              "textColor",
	"WALLPAPER_MODE":          "wallpaperMode",
	"USE_REGEX_FILTER_PREFIX": "useRegexFilter",
	"REGEX_PATTERN_PREFIX":    "regexPattern",
	"WRAP_LINES":              "wrapLines"
}

// Default settings (customizable in Settings window, should be synchronized with settings-schema.json). 
// And pay attention to tricks with colors notation.
const DEFAULTS = function() {
	let all = {};
	all[OPTIONS.DESKLET_WIDTH] =  800;
	all[OPTIONS.DESKLET_HEIGHT] = 600;
	all[OPTIONS.HEADER_COLOR] =   "rgb(255,255,255)";
	all[OPTIONS.FILE_TO_TRACK] =  "/var/log/syslog";
	all[OPTIONS.TEXT_COLOR] =     "rgb(124,252,0)";
	all[OPTIONS.WALLPAPER_MODE] = false;
	all[OPTIONS.WRAP_LINES] =     true;
	// "Use regex filter..." checkboxes and text fields
	all.useRegexFilter0 =         false;
	all.regexPattern0 =           "kernel:.*\\[UFW BLOCK\\].*DST=224\\.0\\.0\\.1";
	all.useRegexFilter1 =         false;
	all.regexPattern1 =           "cinnamon-session";
	all.useRegexFilter2 =         false;
	all.regexPattern2 =           "";
	all.useRegexFilter3 =         false;
	all.regexPattern3 =           "";
	all.useRegexFilter4 =         false;
	all.regexPattern4 =           "";
	return all;
}();


////////////////////////// Core functions //////////////////////////
// Opens file with given name as data stream (in terms of GNOME IO library).
// Path to file may be relational or absolute. But be aware that current working directory 
// is related to Cinnamon desklet environment. So the absolute path is preffered.
// File is opened in 'read' mode;
function openDataStream(filename) {
	let file = Gio.file_new_for_path(filename);
	let inputStream = file.read(null);
	let dataStream = Gio.DataInputStream.new(inputStream);
	return dataStream;
}

// Reads lines from given data stream until the end of file is reached.
// Deletes starting and ending whitespaces in each string.
// Returns resulting strings as array.
function readLinesFromDataStream(dataStream) {
	let allLines = [];
	while (true) {
		let currentLine = dataStream.read_line(null);
		// check for end of the file
		if (currentLine[0] == null) {
			break;	
		}
		// ommit trainling symbol (such as '\n' and so on) and delete surrounding whitespace characters
		let withoutTrailingSymbol = new String(currentLine.slice(0, currentLine.length - 1));
		let withoutSurroundingWhitespaces = withoutTrailingSymbol.trim();
		if ( withoutSurroundingWhitespaces.length == 0 )
			continue;
		let niceString = withoutSurroundingWhitespaces;		
		allLines.push(niceString);		
	}
	return allLines;
}

// Splits string into chunks of length specified by 'chunkLength' parameter.
function splitString(string, chunkLength) {
	if (chunkLength <= 0) 
		return [];
	if (chunkLength > string.length)
		return [string];
	let chunks = [];
	let prevChunkEndIndex = 0;
	for(let index = 1; index < string.length; index++) {
		if (index % chunkLength == 0) {
			let currentChunk = string.slice(prevChunkEndIndex, index);
			chunks.push(currentChunk);
			prevChunkEndIndex = index;
		}
	}
	// don't forget about last chunk
	let lastChunk = string.slice(prevChunkEndIndex, string.length);
	if (lastChunk.length > 0)
		chunks.push(lastChunk);
	return chunks;
}

// Analyzes desklet's settings and returns array of enabled (marked checkboxes) regular expressions patterns.
function getPatterns(settings) {
	let allPatterns = [];
	for(let currentPatternIndex = 0; currentPatternIndex < MAX_REGEX_PATTERNS; currentPatternIndex++ ) {
		// compose name of fields for appropriate settings (in form <string><number>)
		let currentPatternStateField = OPTIONS.USE_REGEX_FILTER_PREFIX + currentPatternIndex;
		let currentPatternValueField = OPTIONS.REGEX_PATTERN_PREFIX + currentPatternIndex;
		// get settings for current pattern
		let isCurrentPatternEnabled = settings.getValue(currentPatternStateField);
		let currentPatternValue = settings.getValue(currentPatternValueField);
		// examine pattern: empty pattern matches to any line, so reject empty patterns;
		// also reject patterns which consist of only whitespace characters 
		// (they are unvisible in settings window and may lead to misunderstanding)
		if ( currentPatternValue.trim().length == 0 )
			continue;
		if (isCurrentPatternEnabled) 
			allPatterns.push(currentPatternValue);
	
	}
	return allPatterns;
}


// Calculates size of virtual screen (from width and height in pixels to width and height in symbols)
// and returns it formed as { "width": ... , height: ... }
function sizeInSymbols(settings) {
	let widthInPixels = settings.getValue(OPTIONS.DESKLET_WIDTH);
	let heightInPixels = settings.getValue(OPTIONS.DESKLET_HEIGHT);
	let widthInSymbols = parseInt(widthInPixels / PIXELS_PER_SYMBOL_HORIZONTAL);
	let heightInSymbols = parseInt(heightInPixels / PIXELS_PER_SYMBOL_VERTICAL) - 2;
	return { "width": widthInSymbols, "height": heightInSymbols };
}

// Reads data from specified settings and returns desklet's size in object
// formed as { "width": ... , height: ... }
function sizeInPixels(settings) {
	let widthInPixels = settings.getValue(OPTIONS.DESKLET_WIDTH);
	let heightInPixels = settings.getValue(OPTIONS.DESKLET_HEIGHT);
	return { "width": widthInPixels, "height": heightInPixels };
}



// Composes label that corresponds to the number of active regular expression filters.
function composeRegexFiltersLabel(numberOfActiveFilters) {
	if (numberOfActiveFilters > 0) 
		return LABELS.FILTERS_IN_USE_PREFIX + LABELS.FILTERS_IN_USE_SUFFIX
	return LABELS.FILTERS_IN_USE_PREFIX	
}



////////////////////////// Core classes //////////////////////////
// Represents virtual text screen. When total number of printed lines reaches height of the screen
// first printed line will be lost.
// Lines can be wrapped to fit screen width.
function Screen(width, height) {
	this.width = width;
	this.height = height;
	this.lines = [];
	this.filter = null;
	this.wrapLines = true;

	this.setWidth = function(width) {
		this.width = width;
	}

	this.setHeight = function(height) {
		this.height = height;
	}

	// Clears virtual screen (at the getText() call empty string will be returned).
	this.clear = function() {
		this.lines = [];
	}

	// Returns content of the screen (where lines are wrapped and total number of lines is 
	// limited to screen width).
	this.getText = function() {
		let text = "";
		for(let index = 0; index < this.lines.length; index++) {
			text += this.lines[index] + "\n";
		}
		return text;
	}

	// Adds lines to the virtual screen. Also filters lines using regular expressions filter
	// (see setFilter() method for details).
	this.addLines = function(newStrings) {
		let stringsAfterFilter = [];
		if (this.filter != null) {
			for(let index = 0; index < newStrings.length; index++) {
				let currentString = newStrings[index];
				if ( !this.filter.test(currentString) )
					stringsAfterFilter.push(currentString);
			}
		} else 
			stringsAfterFilter = newStrings;
		let splittedLines = [];
		if ( this.wrapLines ) {
			for(let index = 0; index < stringsAfterFilter.length; index++) {
				let currentSplittedLine = splitString(stringsAfterFilter[index], this.width);
				splittedLines = splittedLines.concat(currentSplittedLine);
			}
		} else
			splittedLines = stringsAfterFilter;
		this.lines = this.lines.concat(splittedLines);
		if ( this.lines.length > this.height ) {
			this.lines = this.lines.slice( -this.height);
		}
	}

	// Sets filter which will be used to separate unucessary lines.
	this.setFilter = function(filter) {
		this.filter = filter;
	}

	this.enableWrapping = function() {
		this.wrapLines = true;
	}

	this.disableWrapping = function() {
		this.wrapLines = false;
	}
}

// Helper class for holding regular expressions patterns (specified by 'patterns' array)
// and matching strings to them.
function RegexFilter(patterns) {
	this.filters = [];
	for(let index = 0; index < patterns.length; index++) {
		this.filters.push(new RegExp(patterns[index]));
	}
	
	// Returns 'true' if at least one pattern matches to given line.
	this.test = function(string) {
		for(let index = 0; index < this.filters.length; index++) {
			if ( this.filters[index].test(string) )
				return true;
			
		}		
		return false;
	}
}


////////////////////////// Desklet code //////////////////////////
function main(metadata, desklet_id) {
	return new LogPrinterDesklet(metadata, desklet_id);
}

function LogPrinterDesklet(metadata, desklet_id) {
	this._init(metadata, desklet_id);
}

LogPrinterDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

		// run tests
		allTests(GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.metadata.uuid + "/test/sample-files/");

		// read settings
		this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, this.instance_id);

		// all data which is not related to Cinnamon features, but represents 
		// domain of 'Log Printer Desklet' will be stored in Model property
		this.Model = {};
		
		// all created (by ourselves) UI elements will be stored in UI property
		this.UI = {};



		this.EventHandlers = this.bindEventHandlers(this)
		this.bindEventHandlersForUseRegularExpressions(this)
	
		// create user interface elements
		this.setupUI();
	},

	// Adds handlers to tracking changes in 'Settings' window.
	bindEventHandlers: function(desklet) {		
		let handlers = {}		

		handlers.onWallpaperModeChange = function() {
			desklet.settings.getValue(OPTIONS.WALLPAPER_MODE) ? desklet.lock() : desklet.unlock()	
		}

		handlers.onDeskletWidthOrHeightChange = function() {
			desklet.updateDeskletSize()
		}

		handlers.onFileToTrackChange = function() {
			let fileToTrack = desklet.settings.getValue(OPTIONS.FILE_TO_TRACK)
			desklet.UI.logFileNameLabel.set_text(" " + fileToTrack)
			// TODO refactor interacting with files carefully
			// if data stream has been correctly opened previously then close it
			if ( !desklet.Model.refreshPaused ) 
				desklet.Model.dataStream.close(null)
			// open log file to be displayed
			try {
				desklet.Model.dataStream = openDataStream(fileToTrack)
				desklet.Model.refreshPaused = false
			} catch(error) {
				desklet.onFailedToOpenDataStream(fileToTrack, error)
			}
			desklet.Model.screen.clear()
			desklet.refreshScreen()
		}

		handlers.onTextColorChange = function() {
			desklet.updateTextColor()
		}

		handlers.onHeaderColorChange = function() {
			desklet.updateHeaderColor()
		}

		handlers.onWrapLinesChange = function() {
			let wrapLinesState = desklet.settings.getValue(OPTIONS.WRAP_LINES)
			wrapLinesState ? desklet.Model.screen.enableWrapping() : desklet.Model.screen.disableWrapping()
			desklet.refreshScreen()
		}

		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.DESKLET_WIDTH,null, handlers.onDeskletWidthOrHeightChange, null)
		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.DESKLET_HEIGHT, null, handlers.onDeskletWidthOrHeightChange, null)
		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.WALLPAPER_MODE, null, handlers.onWallpaperModeChange, null)
		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.FILE_TO_TRACK, null, handlers.onFileToTrackChange, null)
		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.TEXT_COLOR, null, handlers.onTextColorChange, null)
		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.HEADER_COLOR, null, handlers.onHeaderColorChange, null)
		desklet.settings.bindProperty(Settings.BindingDirection.IN, OPTIONS.WRAP_LINES, null, handlers.onWrapLinesChange, null)

		return handlers
	},

	setupUI: function() {
		// setup whole desklet size; root UI element is '_window'
		let deskletSize = sizeInPixels(this.settings);
		this.UI.window = new St.BoxLayout({ vertical: true, width: deskletSize.width, height: deskletSize.height });	
		this.setContent(this.UI.window);
		// compose header; it includes labels of currently printed file, state of Wallpaper Mode, count of used regex filters.
		// all these labels are arranged horizontally from letf to right		
		this.UI.headerBox = new St.BoxLayout( {vertical: false} ) ;
		this.UI.logFileNameLabel = new St.Label( {style_class: "header-label"} );
		this.UI.wallpaperModeLabel = new St.Label( {style_class: "header-button"} );
		this.UI.regexFiltersInUseLabel = new St.Label( {style_class: "header-button"} );
		this.UI.headerBox.add(this.UI.logFileNameLabel);
		this.UI.headerBox.add(this.UI.wallpaperModeLabel);
		this.UI.headerBox.add(this.UI.regexFiltersInUseLabel);	
		this.UI.window.add(this.UI.headerBox);
		// compose area where log file to be printed
		this.UI.logText = new St.Label({style_class: "log-text"});
		this.UI.logBox = new St.BoxLayout();
		this.UI.logBox.add_actor(this.UI.logText);
		this.UI.window.add(this.UI.logBox);

		// create virual screen
		this.setupVirualScreen();

		// take into accout other settings
		this.EventHandlers.onWallpaperModeChange();
		this.EventHandlers.onTextColorChange();
		this.EventHandlers.onHeaderColorChange();


		// start the timer that updates virtual screen
		this._updateLoop();
	},

	// Initializes virtual screen at desklet's startup.
	setupVirualScreen: function() {
		let screenSize = sizeInSymbols(this.settings);
		this.Model.screen = new Screen(screenSize.width, screenSize.height);
		this.settings.getValue(OPTIONS.WRAP_LINES) ? this.Model.screen.enableWrapping() : this.Model.screen.disableWrapping();
		let fileToTrack = this.settings.getValue(OPTIONS.FILE_TO_TRACK);
		this.UI.logFileNameLabel.set_text(" " + fileToTrack); 
		try {
			this.Model.dataStream = openDataStream(fileToTrack);
			this.Model.refreshPaused = false;
		} catch(error) {
			this.onFailedToOpenDataStream(fileToTrack, error);
		}
		this.updateFilter();
	},
	
	// Refreshes virtual screen (reads the latest lines from log file and prints them on screen).
	refreshScreen: function() {
		if (this.Model.refreshPaused) return;
		let newLines = readLinesFromDataStream(this.Model.dataStream);
		this.Model.screen.addLines(newLines);
		this.UI.logText.set_text( this.Model.screen.getText() );
	},

	// Timer loop (refreshes virtual screen every second).
	_updateLoop: function() {
		this.refreshScreen()
		Mainloop.timeout_add(1000, Lang.bind(this, this._updateLoop));
	}, 

	// For use in "Wallpaper Mode", disables standard context menu (which is usualy displayed on right click).
	_onContextMenuStub: function(menu, open) {
		// close context menu immediatelly
		menu.close();
	},
	
	onFailedToOpenDataStream: function(error, fileName) {
		let errorMessage = "[ERROR] Cannot open file " + fileName + " : " + Json(error);
		global.log(errorMessage);
		this.Model.refreshPaused = true;
	},

	// Reads all filters from Settings windows and setups them for the virtual screen.
	updateFilter: function() {
		let enabledPatterns = getPatterns(this.settings);
		this.Model.screen.setFilter(new RegexFilter(enabledPatterns) );
		// update text 'Filters in use: ...' at the header of desklet
		let filtersInUseText = LABELS.FILTERS_IN_USE_PREFIX + enabledPatterns.length;
		this.UI.regexFiltersInUseLabel.set_text(filtersInUseText);
		this.refreshScreen();
	},

	// Handles click on 'Clear log area' button in 'Settings' window.
	_onClearLogButtonPressed: function() {
		this.Model.screen.clear();
		this.UI.logText.set_text("");
	},

	// Handles click on 'Reset to default settings' button in 'Settings' window.
	_onResetToDefaultsButtonPressed: function() {
		for (let nameOfOption in DEFAULTS) {
			let valueForCurrentOption = DEFAULTS[nameOfOption];
			this.settings.setValue(nameOfOption, valueForCurrentOption);
		}
	},


	// Adds handlers for checkboxes and text fields which are located under 
	// "Use regular expressions to supress unwanted lines" section of "Settings" window.
	// Technically we have 5 checkboxes and 5 corresponding text fields.
	// Instead of binding handlers for each checkbox and text field by hand 
	// we bind them dinamically using eval().
	bindEventHandlersForUseRegularExpressions: function(desklet) {
		let handler = function() { desklet.updateFilter(); }
		for(let currentCheckboxIndex = 0; currentCheckboxIndex < MAX_REGEX_PATTERNS; currentCheckboxIndex++) {
			// compose property name that corresponds to current checkbox
			let currentCheckboxPropertyName = OPTIONS.USE_REGEX_FILTER_PREFIX + currentCheckboxIndex;
			// compose property name that corresponds to current text field
			let currentTextFieldPropertyName = OPTIONS.REGEX_PATTERN_PREFIX + currentCheckboxIndex;
			// glue all together into JavaScript code and evaluate it
			let bindCheckboxCall = "this.settings.bindProperty(Settings.BindingDirection.IN, \"" + currentCheckboxPropertyName + "\", null, handler, null);";
			eval(bindCheckboxCall);
			let bindTextEntryCall = "this.settings.bindProperty(Settings.BindingDirection.IN, \"" + currentTextFieldPropertyName + "\", null, handler, null);"	
			eval(bindTextEntryCall);
		}
	},

	///// 'Wallpaper Mode' routines
	lock: function() {
		this._draggable.inhibit = true // disable dragging using mouse
		this._menu.connect("open-state-changed", Lang.bind(this, this._onContextMenuStub)) // block context menu
		this.UI.wallpaperModeLabel.set_text(LABELS.WALLPAPER_MODE_ON)
	},

	unlock: function() {
		this.UI.wallpaperModeLabel.set_text(LABELS.WALLPAPER_MODE_OFF)
		this._menu.actor.disconnect(this._onContextMenuStub) // TODO fix context menu
		this._draggable.inhibit = false;
	},
	/////


	///// Appearence of content area and header
	updateTextColor: function() {
		let color = textRGBToRGBA(this.settings.getValue(OPTIONS.TEXT_COLOR))
		this.UI.logText.set_style( "color: " + color + ";" )
	},

	updateHeaderColor: function() {
		let color = textRGBToRGBA(this.settings.getValue(OPTIONS.HEADER_COLOR))
		this.UI.headerBox.set_style( "color: " + color + ";" )

	},
	/////


	///// Changes size of the whole desklet (according to current settings)
	updateDeskletSize: function() {
		// resize whole desklet
		let deskletSize = sizeInPixels(this.settings);
		this.UI.window.set_width(deskletSize.width);	
		this.UI.window.set_height(deskletSize.height);	
		// resize virtual screen
		let screenSize = sizeInSymbols(this.settings);
		this.Model.screen.setWidth(screenSize.width);
		this.Model.screen.setHeight(screenSize.height);
		this.EventHandlers.onFileToTrackChange();
		// force display data in already resized screen
		this.refreshScreen();	
	},
	/////

	


}

////////////////////////// TESTS //////////////////////////
function allTests(testDir) {
	LOG.INFO("RUNNING TESTS...")
	LOG.INFO("test directory: " + testDir)
	
	// Define test cases (one function = one group of test cases):
	let test_readLinesFromDataStream = {  
		test_read_empty_file: function(testDir) {
			let expected = [ ]
			let dataStream = openDataStream(testDir + "empty-file.txt")
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		},
			
		test_read_one_line_file: function(testDir) {
			let expected = ["This is the line."]
			let dataStream = openDataStream(testDir + "one-line-file.txt")
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		},

		test_skip_one_line_and_read_the_rest: function(testDir) {
			let expected = [
				"This is the second.",
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			]
			let dataStream = openDataStream(testDir + "five-line-file.txt")
			// skip one line before use our function
			dataStream.read_line(null)
			// read the rest of file
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		},

		test_skip_two_line_and_read_the_rest: function(testDir) {
			let expected = [
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			]
			let dataStream = openDataStream(testDir + "five-line-file.txt")
			// skip two lines before use our function
			dataStream.read_line(null)
			dataStream.read_line(null)
			// read the rest and compare
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		},

		test_skip_all_lines_and_read_the_rest: function(testDir) {
			let expected = [ ]
			let dataStream = openDataStream(testDir + "two-line-file.txt")
			// skip two lines before use our function
			dataStream.read_line(null)
			dataStream.read_line(null)
			// the rest of file should be empty
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		},

		test_ignore_whitespace_lines: function(testDir) {
			let expected = ["first line", "third line"]
			let dataStream = openDataStream(testDir + "file-with-whitespace-line.txt")
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		},
		
		test_ignore_surrounding_whitespaces: function(testDir) {
			let expected = ["usual line", "line with surrounding whitespaces"]
			let dataStream = openDataStream(testDir + "file-with-surrounding-whitespaces.txt")
			let actual = readLinesFromDataStream(dataStream)
			assertEquals(actual, expected)
		}		
	}

	let test_splitString = {
		test_split_empty_string_into_zero_sized_chunks: function() {
			let expected = [ ]
			let actual = splitString("", 0)
			assertEquals(actual, expected)
		},

		test_split_non_empty_string_into_zero_sized_chunks: function() {
			let expected = [ ]
			let actual = splitString("sample string", 0)
			assertEquals(actual, expected);
		},

		test_split_into_chunks_2: function() {
			let expected = ["ap", "pl", "e"]
			let actual = splitString("apple", 2)
			assertEquals(actual, expected)
		},					
		
		test_split_into_chunks_1: function() {
			let expected = ["a", "p", "p", "l", "e"]
			let actual = splitString("apple", 1)
			assertEquals(actual, expected)
		}, 

		test_split_into_chunks_3: function() {
			let expected = ["app", "le"]
			let actual = splitString("apple", 3)
			assertEquals(actual, expected)
		},

		test_split_into_chunks_equal_to_string_length: function() {
			let expected = ["apple"]
			let actual = splitString("apple", 5)
			assertEquals(actual, expected)
		},

		test_split_into_chunks_greater_than_string_length: function() {
			let expected = ["apple"]
			let actual = splitString("apple", 10)
			assertEquals(actual, expected)
		},

		test_split_into_chunks_with_negative_size: function() {
			let expected = []
			let actual = splitString("apple", -1)
			assertEquals(actual, expected)
		}
	}

	let test_Screen = {
		test_get_text_from_clear_screen: function() {
			let expected = ""
			let screen = new Screen(50, 6)
			let actual = screen.getText()
			assertEquals(actual, expected)
		}, 

		test_add_one_line: function() {
			let expected = "one\n"
			let screen = new Screen(50, 6)
			screen.addLines( ["one"] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},
		
		test_add_2_lines_from_6: function() {
			let expected = "one\ntwo\n"
			let screen = new Screen(50, 6)
			screen.addLines( ["one", "two"] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},

		test_add_5_lines_from_5: function() {
			let expected = "1\n2\n3\n4\n5\n"
			let screen = new Screen(50, 5)
			screen.addLines( ["1", "2", "3", "4", "5"] )
			let actual = screen.getText()
			assertEquals(actual, expected)	
		},

		test_overload_empty_screen_with_1_line: function() {
			let expected = "2\n3\n4\n5\n6\n"
			let screen = new Screen(50, 5)
			screen.addLines( ["1", "2", "3", "4", "5", "6"] )
			let actual = screen.getText()
			assertEquals(actual, expected)	
		},
		
		test_oveload_empty_screen_with_2_lines: function() {
			let expected = "3\n4\n5\n6\n7\n"
			let screen = new Screen(50, 5)
			screen.addLines( ["1", "2", "3", "4", "5", "6", "7"] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},

		test_oveload_non_empty_screen_with_3_lines: function() {
			let expected = "4\n5\n6\n7\n8\n"
			let screen = new Screen(50, 5)
			screen.addLines( ["1", "2", "3", "4", "5"] )
			screen.addLines( ["6", "7", "8"] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},
		
		test_overload_screen_with_many_lines: function() {
			let expected = "4\n5\n6\n"
			let screen = new Screen(50, 3)
			screen.addLines( ["1", "2", "3"] )
			screen.addLines( ["4", "5", "6"] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		}, 

		test_add_lines_which_should_be_splitted: function() {
			let expected = "appl\ne\noran\nge\nlime\n"
			let screen = new Screen(4, 5)
			screen.addLines( ["apple", "orange", "lime"] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},

		test_add_lines_which_should_be_splitted_just_another_case: function() {
			let expected = "s ov\ner t\nhe l\nazy \ndog.\n"
			let screen = new Screen(4, 5)
			screen.addLines( ["The quick brown fox jumps over the lazy dog."] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},
		
		test_clear_epmty_screen: function() {
			let expected = ""
			let screen = new Screen(4, 5)
			screen.clear()
			let actual = screen.getText()
			assertEquals(actual, expected)
		},
		
		test_clear_non_epmty_screen: function() {
			let expected = ""
			let screen = new Screen(4, 5)
			screen.addLines( ["This is a test", "Apple"] )
			screen.clear()
			let actual = screen.getText()
			assertEquals(actual, expected)
		},
		
		test_wrap_lines_is_disabled: function() {
			let expected = "This is a test.\nI am the quick brown fox.\n"
			let screen = new Screen(4, 50)
			screen.disableWrapping()
			screen.addLines( ["This is a test.", "I am the quick brown fox."] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		},

		test_wrap_lines_is_enabled_explicitly: function() {
			let expected = "This\n is \na te\nst.\nI am\n the\n qui\nck b\nrown\n fox\n.\n"
			let screen = new Screen(4, 50)
			screen.enableWrapping()
			screen.addLines( ["This is a test.", "I am the quick brown fox."] )
			let actual = screen.getText()
			assertEquals(actual, expected)
		}
	}

	let test_RegexFilter = {
		test_pattern_is_empty: function() {
			let filter = new RegexFilter( [""] )
			let accepted = filter.test("apple")
			assertEquals( accepted, true )
		},

		test_string_is_empty: function() {
			let filter = new RegexFilter( ["abc"] )
			let accepted = filter.test("")
			assertEquals( accepted, false )
		},

		test_with_complex_pattern: function() {
			let filter = new RegexFilter( ["kernel:.*\[UFW BLOCK\].*DST=224\.0\.0\.1"] )
			let accepted = filter.test("May  9 17:00:43 athlonx2 kernel: [46769.866007] [UFW BLOCK] IN=eth0 SRC=192.168.1.1 DST=224.0.0.1")
			assertEquals( accepted, true )
		},

		test_another_complex_pattern: function() {
			let filter = new RegexFilter(["kernel:.*USB"])
			let accepted = filter.test("May  9 17:08:42 athlonx2 kernel: usb-storage 1-9:1.0: USB device detected")
			assertEquals( accepted, true )
		}
	}

	let test_composeRegexFiltersLabel = {
		test_zero_active_filters: function() {
			let expected = " "
			let actual = composeRegexFiltersLabel(0)
			assertEquals(actual, expected)
		},

		test_one_active_filter: function() {
			let expected = " 𐏑"
			let actual = composeRegexFiltersLabel(1)
			assertEquals(actual, expected)
		}
	}

	// Run test cases from each group:
	runTestCases(test_readLinesFromDataStream, testDir);
	runTestCases(test_splitString);
	runTestCases(test_Screen);
	runTestCases(test_RegexFilter);
	runTestCases(test_composeRegexFiltersLabel);

	LOG.INFO("TESTS ARE OK!");
}


////////////////////////// Utility functions //////////////////////////
// Almost copied and pasted from https://github.com/lestcape/Sticky-Notes/blob/master/stickyNotes%40lestcape/desklet.js
function textRGBToRGBA(textRGB) {
	let opacity = "1.0";
	return (textRGB.replace(')',',' + opacity + ')')).replace('rgb','rgba');
}

// Runs all test cases which are contained in 'testSuite' with specified parameters.
function runTestCases(testSuite, parameters = null) {
	for (var testCase in testSuite)
		if (parameters != null) 
			testSuite[testCase](parameters);
		else 
			testSuite[testCase]();						
}

// Converts object into JSON string.
function Json(obj) {
	return JSON.stringify(obj);
}

// Compares two objects (by representing them in JSON). If objects are not equal (appropriate JSON strings are not equal)
// then error arises. In this case desklet running will fail.
// Code is almost copied and pasted from Stackoverflow (http://stackoverflow.com/questions/15313418/javascript-assert).
function assertEquals(actual, expected, message = "") {
	let actualJson = Json(actual);
	let expectedJson = Json(expected);
	
    if ( !(actualJson == expectedJson) ) {
        let fullMessage = "Assertion failed. Expected: " + expectedJson + ". But got: " + actualJson + ". " + message;
        if (typeof Error !== "undefined") {
            throw new Error(fullMessage);
        }
        throw fullMessage; // Fallback
    }
}

// Returns string that contains all methods names in given object.
// Each method is described in separate line.
// Code is copied and pasted from Stackoverflow 
// (http://stackoverflow.com/questions/152483/is-there-a-way-to-print-all-methods-of-an-object-in-javascript).
function getAllMethods(obj) {
	var result = [];
	for (var id in obj) {
		try {
			if (typeof(obj[id]) == "function") {
				result.push(id + ": " + obj[id].toString());
			}
		} catch (err) {
			result.push(id + ": inaccessible");
		}
	}
	return result.join("\n");
}

// Returns string that contains all properties names in given object.
// Each property is described in separate line.
// Code is copied and pasted from Stackoverflow
// (http://stackoverflow.com/questions/208016/how-to-list-the-properties-of-a-javascript-object).
function getAllProperties(obj){
	var keys = [];
	for(var key in obj){
		keys.push(key);
	}
	return keys.join("\n");
}


const LOG = {
	INFO: function(msg) {
		global.log(msg)
	},

	DEBUG: function(msg) {
		global.log('>>> ' + msg)
	}
}

