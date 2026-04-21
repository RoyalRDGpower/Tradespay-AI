# Run this ON the server to set up app + privacy pages + Nginx
echo "Setting up TradesPay AI app pages..."

# 1. Create directories
sudo mkdir -p /var/www/html/app
sudo mkdir -p /var/www/html/privacy

# 2. Copy static files (assumes they're uploaded to ~/)
[ -f ~/tradespay-app.html ]          && sudo cp ~/tradespay-app.html /var/www/html/app/index.html   && echo "✅ App deployed"
[ -f ~/tradespay-landing-v2.html ]   && sudo cp ~/tradespay-landing-v2.html /var/www/html/app/landing.html && echo "✅ Landing page deployed"
[ -f ~/privacy.html ]                && sudo cp ~/privacy.html /var/www/html/privacy/index.html    && echo "✅ Privacy page deployed"
[ -f ~/logo.png ]                    && sudo cp ~/logo.png /var/www/html/app/logo.png              && echo "✅ Logo deployed"
[ -f ~/manifest.json ]               && sudo cp ~/manifest.json /var/www/html/app/manifest.json    && echo "✅ Manifest deployed"
[ -f ~/sw.js ]                       && sudo cp ~/sw.js /var/www/html/app/sw.js                  && echo "✅ Service Worker deployed"

# 3. Setup Nginx Configuration
if [ -f ~/tradespay.nginx.conf ]; then
    echo "⚙️ Configuring Nginx..."
    sudo cp ~/tradespay.nginx.conf /etc/nginx/sites-available/tradespay
    sudo ln -sf /etc/nginx/sites-available/tradespay /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
# 4. (Optional) SSL Setup with Certbot
echo ""
read -p "Do you want to install SSL (HTTPS) via Certbot? (y/n): " install_ssl
if [ "$install_ssl" == "y" ]; then
    echo "🔐 Installing SSL..."
    sudo apt-get update && sudo apt-get install certbot python3-certbot-nginx -y
    sudo certbot --nginx -d tradespay.srdgintel.com -d api.srdgintel.com
    echo "✅ SSL configured for both domains"
fi

echo ""
echo "App URL:   https://tradespay.srdgintel.com"
echo "Privacy:   https://tradespay.srdgintel.com/privacy"
echo "API Check: https://api.srdgintel.com/api/health"
