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
	let workWithFilesTestCases = {  
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

	let workWithStringsTestCases = {
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


	// Test cases (runs):
	for (var testCase in workWithFilesTestCases) {
		workWithFilesTestCases[testCase](testDir);		
	}
	for (var testCase in workWithStringsTestCases) {
		workWithStringsTestCases[testCase]();		
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

