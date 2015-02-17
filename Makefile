NWPATH=$(shell dirname $(shell which nw))

all:
	@nw .

dist: clean
	@cp $(NWPATH)/nw.pak .
	@zip -r -0 lecto.nw *
	@cat $(NWPATH)/nw lecto.nw > lecto
	@chmod +x lecto

clean:
	@rm -f lecto lecto.nw
