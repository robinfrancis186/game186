class TextureGenerator {
    static createTexture(scene, asciiArt, key, color = 0xffffff) {
        const lines = asciiArt.split('\n');
        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        
        // Create a graphics object
        const graphics = scene.add.graphics();
        
        // Set the color
        graphics.fillStyle(color);
        
        // Draw the ASCII art
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = lines[y] ? lines[y][x] : ' ';
                if (char === '█' || char === '┌' || char === '┐' || char === '└' || char === '┘' || char === '│' || char === '─') {
                    graphics.fillRect(x * 2, y * 2, 2, 2);
                }
            }
        }
        
        // Generate texture
        graphics.generateTexture(key, width * 2, height * 2);
        graphics.destroy();
    }

    static createBulletTexture(scene) {
        const bulletArt = `
   ███
  █████
 ███████
  █████
   ███`;
        this.createTexture(scene, bulletArt, 'bullet', 0xffff00);
    }

    static createPlasmaTexture(scene) {
        const plasmaArt = `
   ███
  █████
 ███████
███████████
 ███████
  █████
   ███`;
        this.createTexture(scene, plasmaArt, 'plasma', 0x00ffff);
    }
} 