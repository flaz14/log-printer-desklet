const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Mainloop = imports.mainloop;
const Lang = imports.lang;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Gtk = imports.gi.Gtk;

const MAX_LINES = 10;


function Json(obj) {
	//return JSON.stringify(obj);
	return Object.toJSON(obj);
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
		allLines.push(withoutTrailingSymbol);		
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

		this._currentLines = 0;

		this._dataStream = open_data_stream("/home/yura/Temp/test2.txt");
		
		this.setupUI();
	},
	
	setupUI: function() {	
		this._logBox = new St.BoxLayout( {width: 400, height: 300} );
	
		this._logText = new St.Label();

		this._logBox.add_actor(this._logText);
		this.setContent(this._logBox);
		
		this._updateLoop();
	},

	updateUI: function() {
		let lineFromFile = this._dataStream.read_line(null);
		
		if (lineFromFile[0] == null) {
			return;		
		}

		let previousText = this._logText.get_text();
		this._logText.set_text(previousText + "\n" + lineFromFile);
	},

	_updateLoop: function() {
		this.updateUI()

		Mainloop.timeout_add(1000, Lang.bind(this, this._updateLoop));
	},

		
}

function test_read_empty_file() {
	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/log-printer-desklet@flaz14/test/sample-files/empty-file.txt");
	let expected = read_lines_from_data_stream(dataStream);
	assert( Json(new Array()) ===  Json(expected));
}


function test_read_one_line_file() {
	let expected = new Array();
	expected.push("This is the line.");

	let dataStream = open_data_stream("/home/yura/Projects/log-printer-desklet/log-printer-desklet@flaz14/test/sample-files/one-line-file.txt");
	let actual = read_lines_from_data_stream(dataStream);
	global.log(">>>>>>>>>>>>>>>>>>>>>> " + Json(actual));
	assert( Json(actual) ===  Json(expected));
}


function main(metadata, desklet_id) {
	//test_read_empty_file();
	//test_read_one_line_file();


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

