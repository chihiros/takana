.PHONY: help setup run build preview clean

help:
	@echo "Common targets:"
	@echo "  make setup    - Install npm dependencies"
	@echo "  make run      - Start Vite dev server"
	@echo "  make build    - Build production bundle"
	@echo "  make preview  - Preview built files"
	@echo "  make clean    - Remove node_modules and dist"

setup:
	@echo "Installing dependencies..."
	@npm ci || npm install

run:
	@echo "Dev server at http://localhost:5173"
	@npm run dev

build:
	@npm run build

preview:
	@npm run preview

clean:
	@rm -rf node_modules dist
	@echo "Cleaned build artifacts"
