NWPATH=$(shell dirname $(shell which nw))

all:
	@nw .

dist: clean
	@zip -r -0 lecto.nw *

clean:
	@rm -f lecto lecto.nw
