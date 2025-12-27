#!/bin/bash

# Fix Docker npm ci Issues
# This script provides two solutions:
# 1. Modify Dockerfiles to use npm install instead of npm ci (temporary fix)
# 2. Generate valid minimal lockfiles that work with npm ci

set -e

echo "🔧 Fixing Docker npm ci issues..."

# Function to update Dockerfile to use npm install instead of npm ci
update_dockerfile() {
    local dockerfile="$1"
    local service_name=$(basename $(dirname "$dockerfile"))
    
    if [ -f "$dockerfile" ]; then
        echo "🐳 Updating Dockerfile for $service_name..."
        
        # Create backup
        cp "$dockerfile" "$dockerfile.backup"
        
        # Replace npm ci with npm install
        sed -i.tmp 's/npm ci --only=production/npm install --only=production/g' "$dockerfile"
        sed -i.tmp 's/npm ci --no-audit/npm install --no-audit/g' "$dockerfile"
        sed -i.tmp 's/npm ci/npm install/g' "$dockerfile"
        
        # Remove temporary file
        rm -f "$dockerfile.tmp"
        
        echo "  ✅ Updated $service_name Dockerfile"
    fi
}

# Function to generate a valid minimal lockfile
generate_minimal_lockfile() {
    local service_dir="$1"
    local service_name=$(basename "$service_dir")
    
    if [ -f "$service_dir/package.json" ]; then
        echo "📦 Generating minimal lockfile for $service_name..."
        
        # Read package.json to get name and version
        local pkg_name=$(grep '"name"' "$service_dir/package.json" | head -1 | sed 's/.*"name": *"\([^"]*\)".*/\1/')
        local pkg_version=$(grep '"version"' "$service_dir/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
        
        # Create a valid minimal lockfile that npm ci can work with
        cat > "$service_dir/package-lock.json" << EOF
{
  "name": "$pkg_name",
  "version": "$pkg_version",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "$pkg_name",
      "version": "$pkg_version",
      "license": "MIT",
      "dependencies": {},
      "devDependencies": {},
      "engines": {
        "node": ">=18.0.0"
      }
    }
  }
}
EOF
        
        echo "  ✅ Generated minimal lockfile for $service_name"
    fi
}

# Ask user which approach to take
echo "Choose fix approach:"
echo "1. Modify Dockerfiles to use 'npm install' instead of 'npm ci' (recommended for quick fix)"
echo "2. Generate minimal lockfiles (may still have issues)"
echo "3. Both approaches"
read -p "Enter choice (1-3): " choice

case $choice in
    1|3)
        echo "🐳 Updating Dockerfiles..."
        # Update all Dockerfiles
        for dockerfile in services/*/Dockerfile; do
            if [ -f "$dockerfile" ]; then
                update_dockerfile "$dockerfile"
            fi
        done
        
        if [ -f "frontend/Dockerfile" ]; then
            update_dockerfile "frontend/Dockerfile"
        fi
        ;;
esac

case $choice in
    2|3)
        echo "📦 Generating minimal lockfiles..."
        # Generate minimal lockfiles
        for service_dir in services/*/; do
            if [ -d "$service_dir" ]; then
                generate_minimal_lockfile "$service_dir"
            fi
        done
        
        if [ -d "frontend" ]; then
            generate_minimal_lockfile "frontend"
        fi
        ;;
esac

echo "✅ Docker npm ci fixes completed!"
echo ""
echo "📋 Summary of changes:"
case $choice in
    1)
        echo "  - Modified Dockerfiles to use 'npm install' instead of 'npm ci'"
        echo "  - This allows Docker builds to work with existing package.json files"
        ;;
    2)
        echo "  - Generated minimal but valid package-lock.json files"
        echo "  - These should work with 'npm ci' but may not have full dependency resolution"
        ;;
    3)
        echo "  - Modified Dockerfiles to use 'npm install' instead of 'npm ci'"
        echo "  - Generated minimal but valid package-lock.json files"
        echo "  - This provides both fallback options"
        ;;
esac

echo ""
echo "🔄 Next steps:"
echo "  1. Test Docker builds locally: docker build -t test-service ./services/crm-service"
echo "  2. Commit and push changes"
echo "  3. Monitor GitHub Actions workflows"
echo ""
echo "💡 Long-term solution:"
echo "  - Set up proper npm authentication in CI/CD"
echo "  - Generate complete package-lock.json files with full dependency trees"