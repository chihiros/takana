.PHONY: help vendor run clean

help:
	@echo "Common targets:"
	@echo "  make vendor   - Download UMD p2pt to public/p2pt.min.js"
	@echo "  make run      - Serve static site on http://localhost:5173"
	@echo "  make clean    - Remove vendored assets"

vendor:
	@mkdir -p public
	@echo "Fetching p2pt UMD..."
	@if command -v curl >/dev/null 2>&1; then \
		curl -fL https://cdn.jsdelivr.net/npm/p2pt@1/dist/p2pt.min.js -o public/p2pt.min.js; \
	elif command -v wget >/dev/null 2>&1; then \
		wget -O public/p2pt.min.js https://cdn.jsdelivr.net/npm/p2pt@1/dist/p2pt.min.js; \
	else \
		echo "Please install curl or wget" && exit 1; \
	fi
	@echo "Saved to public/p2pt.min.js"

run:
	@echo "Serving at http://localhost:5173"
	python3 -m http.server -d . 5173

clean:
	@rm -f public/p2pt.min.js
	@echo "Cleaned vendored assets"
