import sharp from 'sharp';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    try {
        console.log('Starting icon generation...');
        for (const size of sizes) {
            console.log(`Generating ${size}x${size} icon...`);
            await sharp('source-icon.png')
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .toFile(`public/icons/icon-${size}x${size}.png`);
            console.log(`✓ Generated ${size}x${size} icon`);
        }
        console.log('✨ All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
    }
}

generateIcons(); 