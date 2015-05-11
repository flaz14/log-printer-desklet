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
const REGEX_STATE_FIELD_PREFIX = "useRegexFilter";
const REGEX_VALUE_FIELD_PREFIX = "regexPattern";

const CHECKBOX_HANDLE_PREFIX = "_onUseRegexFilter";
const CHECKBOX_HANDLE_SUFFIX = "Change";
const ENTRY_HANDLE_PREFIX = "_onRegexPattern";
const ENTRY_HANDLE_SUFFIX = "Change";

const MAX_REGEX_PATTERNS = 5;

////////////////////////// Core functions //////////////////////////

// Opens file with given name as data stream (in terms of GNOME IO library).
// Path may be relational or absolute. But be aware that current working directory 
// is related to Cinnamon desklet environment. So the absolute path is preffered.
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
	let allLines = new Array();
	while (true) {
		let currentLine = dataStream.read_line(null);
		if (currentLine[0] == null) {
			break;	
		}
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
	let lastChunk = string.slice(prevChunkEndIndex, string.length);
	if (lastChunk.length > 0)
		chunks.push(lastChunk);
	return chunks;
}

function getPatterns(settings) {
	let allPatterns = [];
	for(let currentPatternIndex = 0; currentPatternIndex < MAX_REGEX_PATTERNS; currentPatternIndex++ ) {
		// compose name of fields for appropriate settings (in form <string><number>)
		let currentPatternStateField = REGEX_STATE_FIELD_PREFIX + currentPatternIndex;
		let currentPatternValueField = REGEX_VALUE_FIELD_PREFIX + currentPatternIndex;
		// get settings for current pattern
		let isCurrentPatternEnabled = settings.getValue(currentPatternStateField);
		let currentPatternValue = settings.getValue(currentPatternValueField);
		if (isCurrentPatternEnabled) 
			allPatterns.push(currentPatternValue);
	
	}	
	return allPatterns;
}


////////////////////////// Core classes //////////////////////////

// Represents virtual text screen. When total number of printed lines reaches height of the screen
// first printed line will be lost.
function Screen(width, height) {
	this.width = width;
	this.height = height;
	this.lines = [];
	this.filter = null;

	this.getText = function() {
		let text = "";
		for(let index = 0; index < this.lines.length; index++) {
			text += this.lines[index] + "\n";
		}
		return text;
	}

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
		for(let index = 0; index < stringsAfterFilter.length; index++) {
			let currentSplittedLine = splitString(stringsAfterFilter[index], this.width);
			splittedLines = splittedLines.concat(currentSplittedLine);
		}
		this.lines = this.lines.concat(splittedLines);
		if ( this.lines.length > this.height ) {
			this.lines = this.lines.slice( -this.height);
		}
	}

	this.setFilter = function(filter) {
		this.filter = filter;
	}
}

function RegexFilter(patterns) {
	this.filters = []
	for(let index = 0; index < patterns.length; index++) {
		this.filters.push(new RegExp(patterns[index]));
	}
	
	this.test = function(string) {
		for(let index = 0; index < this.filters.length; index++) {
			if ( this.filters[index].test(string) )
				return true;
			
		}		
		return false;
	}
}

////////////////////////// Running Desklet code //////////////////////////
function main(metadata, desklet_id) {
	return new LogPrinterDesklet(metadata, desklet_id);
}

function LogPrinterDesklet(metadata, desklet_id) {
	this._init(metadata, desklet_id);
}

LogPrinterDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	addHandlesForCheckboxesUseRegex: function() {
		for(let currentCheckboxIndex = 0; currentCheckboxIndex < MAX_REGEX_PATTERNS; currentCheckboxIndex++) {
			// compose names of property and name of handle for each checkbox
			let checkboxState = REGEX_STATE_FIELD_PREFIX + currentCheckboxIndex;
			let checkboxHandleName = CHECKBOX_HANDLE_PREFIX + currentCheckboxIndex + CHECKBOX_HANDLE_SUFFIX;
			// compose names of property and name of handle for each text entry
			let textEntryValue = REGEX_VALUE_FIELD_PREFIX + currentCheckboxIndex;
			let textEntryHandleName = ENTRY_HANDLE_PREFIX + currentCheckboxIndex + ENTRY_HANDLE_SUFFIX;
			// compose whole method calls and execute them via 'eval()'
			let bindCheckboxCall = "this.settings.bindProperty(Settings.BindingDirection.IN, \"" + checkboxState + "\", \"" + checkboxState + "\", this." + checkboxHandleName + ", null);";
			eval(bindCheckboxCall);
			let bindTextEntryCall = "this.settings.bindProperty(Settings.BindingDirection.IN, \"" + textEntryValue + "\", \"" + textEntryValue + "\", this." + textEntryHandleName + ", null);"	
			eval(bindTextEntryCall);
		}
	},

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
		this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, this.instance_id);

		this.settings.bindProperty(
			Settings.BindingDirection.IN,
			"fileToTrack",
			"fileToTrack",
			this._onFileToTrackChange,
			null
		);

		this.settings.bindProperty(
			Settings.BindingDirection.IN,
			"textColor",
			"textColor",
			this._onTextColorChange,
			null
		);

		// add handles for checkboxes "Use regular expressions patterns..."
		this.addHandlesForCheckboxesUseRegex();

		// determine location of test directory and run tests 
		let testDir = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.metadata.uuid + "/test/sample-files/"
		run_tests(testDir);

		// calculate size of virtual screens (from width and height in pixels to width and height in symbols)
		this._widthInPixels = this.settings.getValue("logBoxWidth");
		this._heightInPixels = this.settings.getValue("logBoxHeight");
		this._widthInSymbols = parseInt(this._widthInPixels / PIXELS_PER_SYMBOL_HORIZONTAL);
		this._heightInSymbols = parseInt(this._heightInPixels / PIXELS_PER_SYMBOL_VERTICAL) - 2;

		this.screen = new Screen(this._widthInSymbols, this._heightInSymbols);
		
		this.setupUI();
	},

	setupUI: function() {
		this._window = new St.BoxLayout({vertical: true, width: this._widthInPixels, height: this._heightInPixels});
		
		this._header = new St.Label( {style_class: "header-text"} );
		this._window.add(this._header);
	
		this._logText = new St.Label({style_class: "log-text"});
		this._logBox = new St.BoxLayout();
		this._logBox.add_actor(this._logText);
		this._window.add(this._logBox);

		this.setContent(this._window);
	
		this._onFileToTrackChange();
		this._onTextColorChange();
		this.updateFilter();
		this._updateLoop();
	},

	updateUI: function() {
		let newLines = readLinesFromDataStream(this._dataStream);
		
		this.screen.addLines(newLines);

		this._logText.set_text( this.screen.getText() );
	},

	_onFileToTrackChange: function() {
		let fileToTrack = this.settings.getValue("fileToTrack");
		this._header.set_text(" " + fileToTrack); 

		// open log file to be displayed
		this._dataStream = openDataStream(fileToTrack);
		this.screen = new Screen(this._widthInSymbols, this._heightInSymbols);
		this.updateFilter();	
		this.updateUI();
	},

	_onTextColorChange: function() {
		let color = textRGBToRGBA(this.settings.getValue("textColor"));
		this._logText.set_style( "color: " + color + ";" );
	},
	// handles for checkboxes "Use regular expressions patterns..."
	// #1
	_onUseRegexFilter0Change: function() { this.updateFilter(); },
	_onRegexPattern0Change: function() { this.updateFilter(); },
	// #2
	_onUseRegexFilter1Change: function() { this.updateFilter(); },
	_onRegexPattern1Change: function() { this.updateFilter(); },
	// #3
	_onUseRegexFilter2Change: function() { this.updateFilter(); },
	_onRegexPattern2Change: function() { this.updateFilter(); },
	// #4
	_onUseRegexFilter3Change: function() { this.updateFilter(); },
	_onRegexPattern3Change: function() { this.updateFilter(); },
	// #5
	_onUseRegexFilter4Change: function() { this.updateFilter(); },
	_onRegexPattern4Change: function() { this.updateFilter(); },

	updateFilter: function() {
		let enabledPatterns = getPatterns(this.settings);
		this.screen.setFilter( new RegexFilter(enabledPatterns) );
	},

	_updateLoop: function() {
		this.updateUI()

		Mainloop.timeout_add(1000, Lang.bind(this, this._updateLoop));
	}	
}

////////////////////////// Running Tests code //////////////////////////
function run_tests(testDir) {
	// Print debug information:
	global.log("RUNNING TESTS...");
	global.log("test directory: " + testDir)
	
	// Test cases (definitions):
	let test_readLinesFromDataStream = {  
		test_read_empty_file: function(testDir) {
			let expected = [];
			let dataStream = openDataStream(testDir + "empty-file.txt");
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);
		},
			
		test_read_one_line_file: function(testDir) {
			let expected = ["This is the line."];
			let dataStream = openDataStream(testDir + "one-line-file.txt");
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);
		},

		test_skip_one_line_and_read_the_rest: function(testDir) {
			let expected = [
				"This is the second.",
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			];
			let dataStream = openDataStream(testDir + "five-line-file.txt");
			// skip one line before use our function
			dataStream.read_line(null);
			// read the rest of file
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);
		},

		test_skip_two_line_and_read_the_rest: function(testDir) {
			let expected = [
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			];	
			let dataStream = openDataStream(testDir + "five-line-file.txt");
			// skip two lines before use our function
			dataStream.read_line(null);
			dataStream.read_line(null);
			// read the rest and compare
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);
		},

		test_skip_all_lines_and_read_the_rest: function(testDir) {
			let expected = [ ];
			let dataStream = openDataStream(testDir + "two-line-file.txt");
			// skip two lines before use our function
			dataStream.read_line(null);
			dataStream.read_line(null);
			// the rest of file should be empty
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);
		},

		test_ignore_whitespace_lines: function(testDir) {
			let expected = ["first line", "third line"];
			let dataStream = openDataStream(testDir + "file-with-whitespace-line.txt");
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);		
		},
		
		test_ignore_surrounding_whitespaces: function(testDir) {
			let expected = ["usual line", "line with surrounding whitespaces"];
			let dataStream = openDataStream(testDir + "file-with-surrounding-whitespaces.txt");
			let actual = readLinesFromDataStream(dataStream);
			assertEquals(actual, expected);		
		}		
	};

	let test_splitString = {
		test_split_empty_string_into_zero_sized_chunks: function() {
			let expected = [ ];
			let actual = splitString("", 0);
			assertEquals(actual, expected);
		},

		test_split_non_empty_string_into_zero_sized_chunks: function() {
			let expected = [ ];
			let actual = splitString("sample string", 0)
			assertEquals(actual, expected);
		},

		test_split_into_chunks_2: function() {
			let expected = ["ap", "pl", "e"];
			let actual = splitString("apple", 2);
			assertEquals(actual, expected);
		},					
		
		test_split_into_chunks_1: function() {
			let expected = ["a", "p", "p", "l", "e"];
			let actual = splitString("apple", 1);
			assertEquals(actual, expected);
		}, 

		test_split_into_chunks_3: function() {
			let expected = ["app", "le"];
			let actual = splitString("apple", 3);
			assertEquals(actual, expected);
		},

		test_split_into_chunks_equal_to_string_length: function() {
			let expected = ["apple"];
			let actual = splitString("apple", 5);
			assertEquals(actual, expected);
		},

		test_split_into_chunks_greater_than_string_length: function() {
			let expected = ["apple"];
			let actual = splitString("apple", 10);
			assertEquals(actual, expected);
		},

		test_split_into_chunks_with_negative_size: function() {
			let expected = [];
			let actual = splitString("apple", -1);
			assertEquals(actual, expected);
		}
	};

	let test_Screen = {
		test_get_text_from_clear_screen: function() {
			let expected = "";
			let screen = new Screen(50, 6);
			let actual = screen.getText();
			assertEquals(actual, expected);
		}, 

		test_add_one_line: function() {
			let expected = "one\n";
			let screen = new Screen(50, 6);
			screen.addLines( ["one"] );
			let actual = screen.getText();
			assertEquals(actual, expected);
		},
		
		test_add_2_lines_from_6: function() {
			let expected = "one\ntwo\n";
			let screen = new Screen(50, 6);
			screen.addLines( ["one", "two"] );
			let actual = screen.getText();
			assertEquals(actual, expected);
		},

		test_add_5_lines_from_5: function() {
			let expected = "1\n2\n3\n4\n5\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5"] );
			let actual = screen.getText();
			assertEquals(actual, expected);		
		},

		test_overload_empty_screen_with_1_line: function() {
			let expected = "2\n3\n4\n5\n6\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5", "6"] );
			let actual = screen.getText();
			assertEquals(actual, expected);		
		},
		
		test_oveload_empty_screen_with_2_lines: function() {
			let expected = "3\n4\n5\n6\n7\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5", "6", "7"] );
			let actual = screen.getText();
			assertEquals(actual, expected);							
		},

		test_oveload_non_empty_screen_with_3_lines: function() {
			let expected = "4\n5\n6\n7\n8\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5"] );
			screen.addLines( ["6", "7", "8"] );
			let actual = screen.getText();
			assertEquals(actual, expected);							
		},
		
		test_overload_screen_with_many_lines: function() {
			let expected = "4\n5\n6\n";
			let screen = new Screen(50, 3);
			screen.addLines( ["1", "2", "3"] );
			screen.addLines( ["4", "5", "6"] );
			let actual = screen.getText();
			assertEquals(actual, expected);									
		}, 

		test_add_lines_which_should_be_splitted: function() {
			let expected = "appl\ne\noran\nge\nlime\n";
			let screen = new Screen(4, 5);
			screen.addLines( ["apple", "orange", "lime"] );
			let actual = screen.getText();
			assertEquals(actual, expected);	
		},

		test_add_lines_which_should_be_splitted_just_another_case: function() {
			let expected = "s ov\ner t\nhe l\nazy \ndog.\n";
			let screen = new Screen(4, 5);
			screen.addLines( ["The quick brown fox jumps over the lazy dog."] );
			let actual = screen.getText();
			assertEquals(actual, expected);	
		}
	};

	let test_RegexFilter = {
		test_pattern_is_empty: function() {
			let filter = new RegexFilter( [""] );
			let accepted = filter.test("apple");
			assertEquals( true, accepted );
		},

		test_string_is_empty: function() {
			let filter = new RegexFilter( ["abc"] );
			let accepted = filter.test("");
			assertEquals( false, accepted );
		},

		test_with_complex_pattern: function() {
			let filter = new RegexFilter( ["kernel:.*\[UFW BLOCK\].*DST=224\.0\.0\.1"] );
			let accepted = filter.test("May  9 17:00:43 athlonx2 kernel: [46769.866007] [UFW BLOCK] IN=eth0 OUT= MAC=01:04:bb:00:38:d5:c4:7c:1f:44:12:e0:08:08 SRC=192.168.1.1 DST=224.0.0.1 LEN=28 TOS=0x00 PREC=0x00 TTL=1 ID=21685 PROTO=2");
			assertEquals( true, accepted );
		},

		test_another_complex_pattern: function() {
			let filter = new RegexFilter(["kernel:.*USB"]);
			let accepted = filter.test("May  9 17:08:42 athlonx2 kernel: [47248.276705] usb-storage 1-9:1.0: USB Mass Storage device detected");
			assertEquals( true, accepted );
		}

	};
	
	// Test cases (runs):
	runTestCases(test_readLinesFromDataStream, testDir);
	runTestCases(test_splitString);
	runTestCases(test_Screen);
	runTestCases(test_RegexFilter);

	global.log("TESTS OK.");
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

