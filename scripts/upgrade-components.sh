#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (one level up from scripts)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to the project root directory
cd "$PROJECT_ROOT"

# Function to update a component
update_component() {
    local component=$1
    echo "Updating component: $component"
    npx shadcn-vue@latest add --overwrite $component --path "./components/ui/$component"
}

# Find all component directories and update them
for component_dir in components/ui/*/; do
    if [ -d "$component_dir" ]; then
        # Extract component name from path
        component_name=$(basename "$component_dir")
        update_component "$component_name"
    fi
done

echo "All components have been updated!"
