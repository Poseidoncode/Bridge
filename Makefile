# Root Makefile for Bridge project
# Run commands from repository root to operate inside translationgummy-extension.

EXT_DIR = translationgummy-extension

.PHONY: help install build package test watch coverage lint lintfix check

help:
	@echo "Available targets:"
	@echo "  make install    # install npm dependencies"
	@echo "  make build      # build extension"
	@echo "  make package    # build extension and generate icons"
	@echo "  make test       # run vitest tests"
	@echo "  make watch      # run vitest in watch mode"
	@echo "  make coverage   # run vitest with coverage"
	@echo "  make lint       # run eslint"
	@echo "  make lintfix    # run eslint --fix"
	@echo "  make check      # run svelte-check and tsc"

install:
	cd $(EXT_DIR) && npm install

build:
	cd $(EXT_DIR) && npm run build

package:
	cd $(EXT_DIR) && npm run package

test:
	cd $(EXT_DIR) && npm test

watch:
	cd $(EXT_DIR) && npm run test:watch

coverage:
	cd $(EXT_DIR) && npm run test:coverage

lint:
	cd $(EXT_DIR) && npm run lint

lintfix:
	cd $(EXT_DIR) && npm run lint:fix

check:
	cd $(EXT_DIR) && npm run check
