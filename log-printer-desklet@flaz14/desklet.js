const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;

////////////////////////// Core functions //////////////////////////
function open_data_stream(filename) {
	let file = Gio.file_new_for_path(filename);
	let inputStream = file.read(null);
	let dataStream = Gio.DataInputStream.new(inputStream);
	return dataStream;
}

function read_lines_from_data_stream(dataStream) {
	let allLines = new Array();
	while (true) {
		let currentLine = dataStream.read_line(null);
		if (currentLine[0] == null) {
			break;	
		}
		let withoutTrailingSymbol = currentLine.slice(0, currentLine.length - 1);
		let pureJavascriptString = new String(withoutTrailingSymbol);		
		allLines.push(pureJavascriptString);		
	}
	return allLines;
}

function split_string(string, chunkLength) {
	if (chunkLength <= 0) 
		return [];
	if (chunkLength > string.length)
		return [string];
	let chunks = [];
	let prevChunkEndIndex = 0;
	for(index = 1; index < string.length; index++) {
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

////////////////////////// Core classes //////////////////////////
function Screen(width, height) {
	this.width = width;
	this.height = height;
	this.lines = [];

	this.getText = function() {
		let text = "";
		for(index = 0; index < this.lines.length; index++) {
			text += this.lines[index] + "\n";
		}
		return text;
	}

	this.addLines = function(newStrings) {
		let splittedLines = [];
		for(let index = 0; index < newStrings.length; index++) {
			let currentSplittedLine = split_string(newStrings[index], this.width);
			splittedLines = splittedLines.concat(currentSplittedLine);
		}
		this.lines = this.lines.concat(splittedLines);
		if ( this.lines.length > this.height ) {
			this.lines = this.lines.slice( -this.height);
		}
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

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
		this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, this.instance_id);

		// determine location of test directory and run tests 
		let testDir = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.metadata.uuid + "/test/sample-files/"
		run_tests(testDir);

		// initialize worker objects
//		this.screen = new Screen(64, 48);
		

		// open log file to be displayed
		this._dataStream = open_data_stream("/home/yura/Temp/test2.txt");
		
		this.setupUI();
	},

	setupUI: function() {	
		this._logBox = new St.BoxLayout( {width: 400, height: 300, style_class: "log-box"} );
	
		this._logText = new St.Label({style_class: "log-text"});

		this._logBox.add_actor(this._logText);
		this.setContent(this._logBox);
		
		this._updateLoop();
	},

	updateUI: function() {
		let newLines = read_lines_from_data_stream(this._dataStream);
		
		let previousText = this._logText.get_text();
		for(index = 0; index < newLines.length; ++index) {
			this._logText.set_text(previousText + "\n" + newLines[index]);
			previousText = this._logText.get_text();
		}	
	},

	_updateLoop: function() {
		this.updateUI()

		Mainloop.timeout_add(1000, Lang.bind(this, this._updateLoop));
	},	
}

////////////////////////// Running Tests code //////////////////////////
function run_tests(testDir) {
	// Print debug information:
	global.log("RUNNING TESTS...");
	global.log("test directory: " + testDir)
	
	// Test cases (definitions):
	let test_read_lines_from_data_stream = {  
		test_read_empty_file: function(testDir) {
			let expected = [];
			let dataStream = open_data_stream(testDir + "empty-file.txt");
			let actual = read_lines_from_data_stream(dataStream);
			assert( Json(actual) ===  Json(expected));
		},
			
		test_read_one_line_file: function(testDir) {
			let expected = ["This is the line."];
			let dataStream = open_data_stream(testDir + "one-line-file.txt");
			let actual = read_lines_from_data_stream(dataStream);
			assert( Json(actual) ===  Json(expected) );
		},

		test_skip_one_line_and_read_the_rest: function(testDir) {
			let expected = [
				"This is the second.",
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			];
			let dataStream = open_data_stream(testDir + "five-line-file.txt");
			// skip one line before use our function
			dataStream.read_line(null);
			// read the rest of file
			let actual = read_lines_from_data_stream(dataStream);
			assert( Json(actual) ===  Json(expected) );
		},

		test_skip_two_line_and_read_the_rest: function(testDir) {
			let expected = [
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			];	
			let dataStream = open_data_stream(testDir + "five-line-file.txt");
			// skip two lines before use our function
			dataStream.read_line(null);
			dataStream.read_line(null);
			// read the rest and compare
			let actual = read_lines_from_data_stream(dataStream);
			assert( Json(actual) ===  Json(expected) );
		},

		test_skip_all_lines_and_read_the_rest: function(testDir) {
			let expected = [ ];
			let dataStream = open_data_stream(testDir + "two-line-file.txt");
			// skip two lines before use our function
			dataStream.read_line(null);
			dataStream.read_line(null);
			// the rest of file should be empty
			let actual = read_lines_from_data_stream(dataStream);
			assert( Json(actual) ===  Json(expected) );
		}
	};

	let test_split_string = {
		test_split_empty_string_into_zero_sized_chunks: function() {
			let expected = [ ];
			let actual = split_string("", 0);
			assert( Json(actual) == Json(expected) );
		},

		test_split_non_empty_string_into_zero_sized_chunks: function() {
			let expected = [ ];
			let actual = split_string("sample string", 0)
			assert( Json(actual) == Json(expected) );
		},

		test_split_into_chunks_2: function() {
			let expected = ["ap", "pl", "e"];
			let actual = split_string("apple", 2);
			assert( Json(actual) == Json(expected) );
		},					
		
		test_split_into_chunks_1: function() {
			let expected = ["a", "p", "p", "l", "e"];
			let actual = split_string("apple", 1);
			assert( Json(actual) == Json(expected) );
		}, 

		test_split_into_chunks_3: function() {
			let expected = ["app", "le"];
			let actual = split_string("apple", 3);
			assert( Json(actual) == Json(expected) );
		},

		test_split_into_chunks_equal_to_string_length: function() {
			let expected = ["apple"];
			let actual = split_string("apple", 5);
			assert( Json(actual) == Json(expected) );
		},

		test_split_into_chunks_greater_than_string_length: function() {
			let expected = ["apple"];
			let actual = split_string("apple", 10);
			assert( Json(actual) == Json(expected) );
		},

		test_split_into_chunks_with_negative_size: function() {
			let expected = [];
			let actual = split_string("apple", -1);
			assert( Json(actual) == Json(expected) );
		}
	};

	let test_screen = {
		test_get_text_from_clear_screen: function() {
			let expected = "";
			let screen = new Screen(50, 6);
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );
		}, 

		test_add_one_line: function() {
			let expected = "one\n";
			let screen = new Screen(50, 6);
			screen.addLines( ["one"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );
		},
		
		test_add_2_lines_from_6: function() {
			let expected = "one\ntwo\n";
			let screen = new Screen(50, 6);
			screen.addLines( ["one", "two"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );
		},

		test_add_5_lines_from_5: function() {
			let expected = "1\n2\n3\n4\n5\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );		
		},

		test_overload_empty_screen_with_1_line: function() {
			let expected = "2\n3\n4\n5\n6\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5", "6"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );		
		},
		
		test_oveload_empty_screen_with_2_lines: function() {
			let expected = "3\n4\n5\n6\n7\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5", "6", "7"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );							
		},

		test_oveload_non_empty_screen_with_3_lines: function() {
			let expected = "4\n5\n6\n7\n8\n";
			let screen = new Screen(50, 5);
			screen.addLines( ["1", "2", "3", "4", "5"] );
			screen.addLines( ["6", "7", "8"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );							
		},
		
		test_overload_screen_with_many_lines: function() {
			let expected = "4\n5\n6\n";
			let screen = new Screen(50, 3);
			screen.addLines( ["1", "2", "3"] );
			screen.addLines( ["4", "5", "6"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );									
		}, 

		test_add_lines_which_should_be_splitted: function() {
			let expected = "appl\ne\noran\nge\nlime\n";
			let screen = new Screen(4, 5);
			screen.addLines( ["apple", "orange", "lime"] );
			let actual = screen.getText();
			assert( Json(actual) == Json(expected) );	
		},

		test_add_lines_which_should_be_splitted_just_another_case: function() {
			let expected = "s ov\ner t\nhe l\nazy \ndog.\n";
			let screen = new Screen(4, 5);
			screen.addLines( ["The quick brown fox jumps over the lazy dog."] );
			let actual = screen.getText();
			global.log(">>>>> " + actual);
			assert( Json(actual) == Json(expected) );	
		}
	};

	let test_scroll_screen = {};
	
	// Test cases (runs):
	for (var testCase in test_read_lines_from_data_stream) {
		test_read_lines_from_data_stream[testCase](testDir);		
	}
	for (var testCase in test_split_string) {
		test_split_string[testCase]();		
	}
	for (var testCase in test_screen) {
		test_screen[testCase]();		
	}		

	global.log("TESTS OK.");
}

////////////////////////// Utility functions //////////////////////////

// Converts object into JSON string.
function Json(obj) {
	return JSON.stringify(obj);
}

// Checks whether 'condition' is true. 
// If 'condition' is false then error arises. In this case running desklet will be unsuccessful.
// Code is copied and pasted from Stackoverflow (http://stackoverflow.com/questions/15313418/javascript-assert).
function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
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

