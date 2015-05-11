UUID= log-printer-desklet@flaz14

FILES= 						\
		$(UUID)/desklet.js		\
		$(UUID)/metadata.json		\
		$(UUID)/stylesheet.css		\
		$(UUID)/settings-schema.json	

TESTDIR= 	$(UUID)/test					
		

DESKLETDIR= ~/.local/share/cinnamon/desklets/
DESTDIR= $(DESKLETDIR)$(UUID)

install: $(FILES)
	mkdir -p $(DESTDIR)
	cp $(FILES) $(DESTDIR)
	cp -R $(TESTDIR) $(DESTDIR)

show-settings: 
	cinnamon-settings desklets $(UUID)
