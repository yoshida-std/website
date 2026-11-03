CC65_BIN ?= /tmp/cc65/bin
CA65 = $(CC65_BIN)/ca65
LD65 = $(CC65_BIN)/ld65
ROM  = build/horihori.nes

all: $(ROM)

assets/chr.bin assets/map.bin assets/colcell.bin assets/rowlo.bin assets/rowhi.bin: tools/make_assets.py ../robo.png
	python3 tools/make_assets.py

build/main.o: src/main.s assets/chr.bin assets/map.bin assets/colcell.bin assets/rowlo.bin assets/rowhi.bin
	mkdir -p build
	$(CA65) -g -o $@ src/main.s

$(ROM): build/main.o nes.cfg
	$(LD65) -o $@ -C nes.cfg build/main.o

clean:
	rm -rf build
