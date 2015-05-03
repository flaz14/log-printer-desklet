const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Mainloop = imports.mainloop;
const Lang = imports.lang;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Gtk = imports.gi.Gtk;



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


function LogPrinterDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

LogPrinterDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

		this.setupUI();
	},
	
	setupUI: function() {	
		this._window = new St.Bin();

		this._logArea = new St.ScrollView();
		this._logArea.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
		
		this._text = new St.Label();
		

		this._window.add_actor(this._text);
		this.setContent(this._window);
		
		this._updateLoop();
	},

	updateUI: function() {
		let currentTimeAsText = (new Date()).toLocaleFormat("%l:%M:%S");
		this._text.set_text(currentTimeAsText);
	},

	_updateLoop: function() {
		global.log(">>>>> Inside _updateLoop");
		
		this.updateUI()

		Mainloop.timeout_add(1000, Lang.bind(this, this._updateLoop));
	},

		
}

function main(metadata, desklet_id) {
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

