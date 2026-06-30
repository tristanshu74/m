#!/bin/bash
# Met à jour le timestamp "Updated ..." dans delivery.html avec l'heure actuelle Paris
NOW=$(TZ='Europe/Paris' date '+%B %-d · %H:%M')
sed -i '' "s|<span class=\"meta\">Updated [^<]*</span>|<span class=\"meta\">Updated ${NOW}</span>|g" delivery.html
echo "✅ Timestamp updated : $NOW"
