CC65_BIN ?= /tmp/cc65/bin
CA65 = $(CC65_BIN)/ca65
LD65 = $(CC65_BIN)/ld65
ROM  = build/horihori.nes

all: $(ROM)

assets/chr.bin assets/map.bin assets/colcell.bin assets/rowlo.bin assets/rowhi.bin assets/hud.bin assets/title.bin assets/resattr.bin: tools/make_assets.py ../robo.png
	python3 tools/make_assets.py

assets/sound.inc: tools/make_sound.py assets/bgm_notes.json
	python3 tools/make_sound.py

build/main.o: src/main.s assets/sound.inc assets/chr.bin assets/map.bin assets/colcell.bin assets/rowlo.bin assets/rowhi.bin assets/hud.bin assets/title.bin assets/resattr.bin
	mkdir -p build
	$(CA65) -g -o $@ src/main.s

$(ROM): build/main.o nes.cfg
	$(LD65) -o $@ -C nes.cfg -Ln build/horihori.lbl build/main.o

clean:
	rm -rf build
