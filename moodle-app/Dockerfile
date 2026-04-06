FROM php:8.1-apache

# System dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    zip \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libzip-dev \
    libonig-dev \
    libxml2-dev \
    libicu-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    mysqli \
    gd \
    zip \
    intl \
    opcache
RUN echo "max_input_vars=5000" >> /usr/local/etc/php/conf.d/custom.ini
# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html

# Download Moodle (stable branch)
RUN git clone --depth=1 -b MOODLE_401_STABLE https://github.com/moodle/moodle.git .

# Create moodledata directory with proper permissions
RUN mkdir -p /var/www/moodledata && \
    chown www-data:www-data /var/www/moodledata && \
    chmod 755 /var/www/moodledata

# Permissions
RUN chown -R www-data:www-data /var/www/html

RUN echo "max_input_vars=5000" >> /usr/local/etc/php/conf.d/custom.ini
# Expose port
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
