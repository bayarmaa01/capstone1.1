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

# Clone and install Moodle Attendance plugin
RUN git clone --depth=1 -b MOODLE_401_STABLE https://github.com/danmarsden/moodle-mod_attendance.git /var/www/html/mod/attendance && \
    chown -R www-data:www-data /var/www/html/mod/attendance && \
    chmod -R 755 /var/www/html/mod/attendance

# Create moodledata directory with proper permissions
RUN mkdir -p /var/www/moodledata && \
    chown www-data:www-data /var/www/moodledata && \
    chmod 755 /var/www/moodledata

# Set proper ownership and switch to non-root user
RUN chown -R www-data:www-data /var/www/html && \
    chsh -s /bin/bash www-data
USER www-data

RUN echo "max_input_vars=5000" >> /usr/local/etc/php/conf.d/custom.ini
# Expose port
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
