const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Mainloop = imports.mainloop;
const Lang = imports.lang;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Gtk = imports.gi.Gtk;

const Settings = imports.ui.settings;

const MAX_LINES = 10;


function Json(obj) {
	return JSON.stringify(obj);
	//return Object.toJSON(obj);
}

// Copied and pasted from Stackoverflow 
// (http://stackoverflow.com/questions/15313418/javascript-assert)
function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

// Copied and pasted from Stackoverflow 
// (http://stackoverflow.com/questions/152483/is-there-a-way-to-print-all-methods-of-an-object-in-javascript)
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

// Copied and pasted from Stackoverflow
// (http://stackoverflow.com/questions/208016/how-to-list-the-properties-of-a-javascript-object)
function getAllProperties(obj){
	var keys = [];
	for(var key in obj){
		keys.push(key);
	}
	return keys.join("\n");
}

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



function LogPrinterDesklet(metadata, desklet_id) {
	this._init(metadata, desklet_id);
}

LogPrinterDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

            this.settings = new Settings.DeskletSettings(
                    this, this.metadata.uuid, this.instance_id);

		global.log(">>>>>>>>>>>>>>>>> " + getAllProperties(this.settings));
		global.log("||||||||||||||||| " + getAllMethods(this.settings));		
		global.log("property: " + this.settings.getValue("logBoxWidth"));
		global.log("path to file: " + this.settings.get_file_path());

//            this.settings.bindProperty(
  //                  Settings.BindingDirection.IN,
    //                "subreddit",
      //              "subreddit",
        //            this._onSubredditChange,
          //          null);


		this._currentLines = 0;

		this._dataStream = open_data_stream("/home/yura/Temp/test2.txt");
//		this._dataStream = open_data_stream("/var/log/syslog");
		
		this.setupUI();
	},

    _onSubredditChange: function() {

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

function test_read_empty_file() {
	let expected = [];

	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/test/sample-files/empty-file.txt");
	let actual = read_lines_from_data_stream(dataStream);
	assert( Json(actual) ===  Json(expected));
}


function test_read_one_line_file() {
	let expected = ["This is the line."];

	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/test/sample-files/one-line-file.txt");
	let actual = read_lines_from_data_stream(dataStream);

	assert( Json(actual) ===  Json(expected) );
}

function test_skip_one_line_and_read_the_rest() {
	let expected = [
				"This is the second.",
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			];

	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/test/sample-files/five-line-file.txt");
	// skip one line before use our function
	dataStream.read_line(null);

	// read the rest and compare
	let actual = read_lines_from_data_stream(dataStream);

	assert( Json(actual) ===  Json(expected) );
}

function test_skip_two_line_and_read_the_rest() {
	let expected = [
				"The third333",
				"The fourth line.",
				"And the fifth line is here"
			];

	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/test/sample-files/five-line-file.txt");
	// skip two lines before use our function
	dataStream.read_line(null);
	dataStream.read_line(null);

	// read the rest and compare
	let actual = read_lines_from_data_stream(dataStream);

	assert( Json(actual) ===  Json(expected) );
}

function test_skip_all_lines_and_read_the_rest() {
	let expected = [ ];

	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/test/sample-files/two-line-file.txt");
	// skip two lines before use our function
	dataStream.read_line(null);
	dataStream.read_line(null);

	// the rest of file should be empty
	let actual = read_lines_from_data_stream(dataStream);

	assert( Json(actual) ===  Json(expected) );
}

function main(metadata, desklet_id) {
//	test_read_empty_file();
//	test_read_one_line_file();
//	test_skip_one_line_and_read_the_rest();
//	test_skip_two_line_and_read_the_rest();
//	test_skip_all_lines_and_read_the_rest();

	return new LogPrinterDesklet(metadata, desklet_id);
}

// let f = Gio.file_new_for_path("/var/log/syslog");
// global.log(getAllMethods(f));
// let stream = f.read(null);
// global.log(getAllMethods(stream));
// let dstream = Gio.DataInputStream.new(stream)
// global.log(getAllMethods(dstream));
// let text = dstream.read_line(null)
// global.log(">>>>>>>>>>>>>>>> " + text)

