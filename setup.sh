#!/bin/bash

# SalonOS Development Setup Script for Unix-like systems (Linux, macOS)

echo "========================================"
echo "SalonOS - Quick Setup Script"
echo "========================================"
echo ""

# Check if Node.js is installed
echo "[1/6] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
node --version
echo "Node.js found!"
echo ""

# Check if .env.local exists
echo "[2/6] Checking environment configuration..."
if [ -f .env.local ]; then
    echo ".env.local already exists"
else
    if [ -f .env.example ]; then
        echo "Creating .env.local from .env.example..."
        cp .env.example .env.local
        echo ""
        echo "IMPORTANT: Please edit .env.local and add your Supabase credentials!"
        echo ""
    else
        echo "ERROR: .env.example not found!"
        exit 1
    fi
fi
echo ""

# Install dependencies
echo "[3/6] Installing dependencies..."
echo "This may take a few minutes..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies!"
    exit 1
fi
echo "Dependencies installed successfully!"
echo ""

# Type check
echo "[4/6] Running type check..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "WARNING: Type check failed. Please review errors above."
else
    echo "Type check passed!"
fi
echo ""

# Lint
echo "[5/6] Running linter..."
npm run lint
if [ $? -ne 0 ]; then
    echo "WARNING: Linting issues found. Please review above."
else
    echo "Linting passed!"
fi
echo ""

# Build check
echo "[6/6] Testing build..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed! Please check for errors above."
    echo "Make sure your .env.local has valid Supabase credentials."
    exit 1
fi
echo "Build successful!"
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Apply database migrations in Supabase SQL Editor"
echo "3. Run: npm run dev"
echo "4. Visit: http://localhost:3000"
echo ""
echo "For detailed instructions, see QUICKSTART.md"
echo "========================================"
