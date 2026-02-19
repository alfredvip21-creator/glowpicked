#!/bin/bash
# 🤖 GLOWPICKED - Setup Weekly Data Verification Cron Job
#
# Installe un cron job pour vérifier les données Amazon chaque lundi à 9h
# Usage: ./setup-weekly-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_LOG="$PROJECT_DIR/logs/weekly-verification.log"

# Créer le dossier logs si nécessaire
mkdir -p "$PROJECT_DIR/logs"

# Script wrapper qui va être appelé par cron
WRAPPER_SCRIPT="$SCRIPT_DIR/run-weekly-verification.sh"
cat > "$WRAPPER_SCRIPT" << EOF
#!/bin/bash
# Wrapper pour la vérification hebdomadaire - appelé par cron

# Setup environment
export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"
cd "$PROJECT_DIR"

# Log start
echo "=== Weekly Verification Started: \$(date) ===" >> "$CRON_LOG"

# Run verification with timeout (max 30 minutes)
timeout 1800 node "$SCRIPT_DIR/weekly-data-verification.js" >> "$CRON_LOG" 2>&1
EXIT_CODE=\$?

# Log result
if [ \$EXIT_CODE -eq 0 ]; then
    echo "✅ Weekly verification completed successfully" >> "$CRON_LOG"
    
    # If changes were detected, auto-commit and push (optional)
    if [ -f "$PROJECT_DIR/data/weekly-verification-report.md" ]; then
        cd "$PROJECT_DIR"
        git add data/real-review-counts.json data/weekly-verification-report.md
        git commit -m "📊 Weekly data verification - \$(date +%Y-%m-%d)

Auto-updated product ratings and review counts from Amazon.
See weekly-verification-report.md for details." 2>> "$CRON_LOG"
        
        # Push to GitHub (uncomment if auto-push desired)
        # git push origin main 2>> "$CRON_LOG"
        echo "📝 Changes committed to git" >> "$CRON_LOG"
    fi
    
elif [ \$EXIT_CODE -eq 124 ]; then
    echo "⏰ Weekly verification timed out (30 minutes)" >> "$CRON_LOG"
else
    echo "❌ Weekly verification failed with exit code \$EXIT_CODE" >> "$CRON_LOG"
fi

echo "=== Weekly Verification Ended: \$(date) ===" >> "$CRON_LOG"
echo "" >> "$CRON_LOG"

# Keep log file manageable (last 100 lines)
tail -n 100 "$CRON_LOG" > "$CRON_LOG.tmp" && mv "$CRON_LOG.tmp" "$CRON_LOG"
EOF

# Rendre le wrapper exécutable
chmod +x "$WRAPPER_SCRIPT"

# Définir la ligne cron (chaque lundi à 9h)
CRON_LINE="0 9 * * 1 $WRAPPER_SCRIPT"

# Ajouter au crontab (sans dupliquer)
(crontab -l 2>/dev/null | grep -v "$WRAPPER_SCRIPT"; echo "$CRON_LINE") | crontab -

echo "✅ Cron job configuré avec succès!"
echo ""
echo "📅 Planification: Chaque lundi à 9h00"
echo "📝 Log file: $CRON_LOG"
echo "🔧 Wrapper script: $WRAPPER_SCRIPT"
echo ""
echo "Pour vérifier: crontab -l"
echo "Pour tester maintenant: $WRAPPER_SCRIPT"
echo "Pour désactiver: crontab -l | grep -v '$WRAPPER_SCRIPT' | crontab -"