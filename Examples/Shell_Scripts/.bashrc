# .bashrc example

# Export some variables
export EDITOR="ext"
export PATH="$HOME/.local/bin:$PATH"

# Aliases
alias ll='ls -la'
alias ext-run='npm run dev'

# Functions
function setup_ext() {
  echo "Setting up EXT environment..."
  # Do not include destructive commands here
  echo "Done!"
}
