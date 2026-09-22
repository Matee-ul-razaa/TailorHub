export const categories = [
  { id: 'pent-coat', label: 'Pent Coat', icon: '🧥', image: '/catalog/garments/g1.jpg' },
  { id: 'shalwar-kameez', label: 'Shalwar Kameez', icon: '🧵', image: '/catalog/garments/g6.jpg' },
  { id: 'unstitched-pent-coat', label: 'Unstitched Pent Coat', icon: '✂️', image: '/catalog/garments/us_1-1.jpg' },
  { id: 'unstitched-shalwar-kameez', label: 'Unstitched Shalwar Kameez', icon: '✂️', image: '/catalog/garments/us_6-1.jpg' },
];

const PRODUCTS_PER_CATEGORY = 5;

const descriptors = [
  'Royal', 'Signature', 'Modern', 'Classic', 'Heritage', 'Urban', 'Executive', 'Refined',
  'Premier', 'Noble', 'Crafted', 'Majestic', 'Contemporary', 'Prestige', 'Tailored', 'Elite',
  'Luxe', 'Fine', 'Regal', 'Prime', 'Sophisticated', 'Timeless', 'Artisan', 'Grand',
];

const pentCoatPalettes = [
  ['Ivory', 'Gold', 'Maroon', 'Black'],
  ['Navy', 'Teal', 'Charcoal', 'Olive'],
  ['Cream', 'Rust', 'Bottle Green', 'Plum'],
  ['Ivory', 'Gold', 'Maroon', 'Black'],
  ['Navy', 'Teal', 'Charcoal', 'Olive'],
];

const unstitchedPentCoatPalettes = [
  ['Ivory', 'Gold', 'Black', 'Maroon'],
  ['Navy', 'Teal', 'Charcoal', 'Olive'],
  ['Cream', 'Rust', 'Bottle Green', 'Plum'],
  ['Ivory', 'Gold', 'Maroon', 'Black'],
  ['Navy', 'Teal', 'Charcoal', 'Olive'],
];

const shalwarKameezPalettes = [
  ['Beige', 'Mustard', 'Maroon', 'Black'],
  ['Navy', 'Teal', 'Charcoal', 'Olive'],
  ['Cream', 'Rust', 'Bottle Green', 'Plum'],
  ['Ivory', 'Gold', 'Maroon', 'Black'],
  ['Navy', 'Teal', 'Charcoal', 'Olive'],
];

const unstitchedShalwarKameezPalettes = shalwarKameezPalettes;

const categorySeeds = {
  'pent-coat': {
    wearType: 'western',
    baseNames: [
      'Prince Coat', 'Designer Pent Coat', 'Wedding Pent Coat', 'Formal Pent Coat',
      'Embroidered Pent Coat'
    ],
    fabrics: ['Jamawar Silk', 'Raw Silk', 'Brocade', 'Cotton Silk', 'Velvet'],
    palettes: pentCoatPalettes,
    availableModes: ['ready-to-wear', 'custom-stitching', 'unstitched'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    basePrice: 8500,
    step: 600,
    hasWaistcoatOption: false,
    suitOptions: ['2-piece', '3-piece', 'blazer-only', 'pants-only'],
    description: 'Premium men\'s pent coat (prince coat) with elegant tailoring, perfect for formal events.',
  },
  'shalwar-kameez': {
    wearType: 'traditional',
    baseNames: [
      'Embroidered Kurta Pajama', 'Festive Kurta Set', 'Classic Kurta Pajama', 'Wedding Kurta Ensemble',
      'Premium Shalwar Kameez'
    ],
    fabrics: ['Wash & Wear', 'Boski Cotton', 'Blended Wash & Wear', 'Banarsi Silk', 'Raw Silk'],
    palettes: shalwarKameezPalettes,
    availableModes: ['ready-to-wear', 'custom-stitching', 'unstitched'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    basePrice: 7600,
    step: 500,
    hasWaistcoatOption: true,
    suitOptions: ['kameez-shalwar', 'kameez-only', 'shalwar-only'],
    description: 'Traditional men\'s shalwar kameez with contemporary finesse, featuring rich detailing.',
  },
  'unstitched-pent-coat': {
    wearType: 'western',
    baseNames: [
      'Premium Suiting Fabric', 'Classic Suiting Fabric', 'Egyptian Suiting Fabric', 'Latha Suiting Fabric',
      'Gents Suiting Fabric'
    ],
    fabrics: ['Jamawar Silk', 'Raw Silk', 'Brocade', 'Cotton Silk', 'Velvet'],
    palettes: unstitchedPentCoatPalettes,
    availableModes: ['unstitched'],
    sizes: ['4 Meters', '4.5 Meters', '5 Meters'],
    basePrice: 4500,
    step: 300,
    hasWaistcoatOption: false,
    description: 'High-quality unstitched suiting fabric, perfect for custom tailoring of pent coats.',
  },
  'unstitched-shalwar-kameez': {
    wearType: 'traditional',
    baseNames: [
      'Premium Wash & Wear Fabric', 'Classic Boski Fabric', 'Egyptian Cotton Fabric', 'Latha Fabric',
      'Karandi Fabric'
    ],
    fabrics: ['Wash & Wear', 'Boski Cotton', 'Blended Wash & Wear', 'Banarsi Silk', 'Raw Silk'],
    palettes: unstitchedShalwarKameezPalettes,
    availableModes: ['unstitched'],
    sizes: ['4 Meters', '4.5 Meters', '5 Meters'],
    basePrice: 3500,
    step: 300,
    hasWaistcoatOption: false,
    description: 'High-quality unstitched fabric for men, perfect for custom tailoring of shalwar kameez.',
  }
};

const getCategoryPrompt = (categoryLabel, fabric, colors) =>
  `ultra realistic studio fashion catalog image of men's ${categoryLabel}, ${fabric}, ${colors.join(', ')}, full body, premium tailoring, softbox lighting, 4k detail`;

export const allGarments = [
  // Pent Coat (g1-g5)
  { id: 'garment-1',  image: '/catalog/garments/g1.jpg',  name: "Men's Pent Coat 1",  category: 'pent-coat', aiDescription: 'men\'s full body pent coat outfit, prince coat with kurta and trousers, formal long coat over kurta, complete outfit including pants, full sleeves, knee length coat, ceremonial style, rich fabric, show entire outfit not just upper body' },
  { id: 'garment-2',  image: '/catalog/garments/g2.jpg',  name: "Men's Pent Coat 2",  category: 'pent-coat', aiDescription: 'men\'s full body pent coat outfit, wedding formal wear with kurta and trousers, complete outfit including pants, full sleeves, knee length coat, elegant tailoring, show entire outfit from head to toe' },
  { id: 'garment-3',  image: '/catalog/garments/g3.jpg',  name: "Men's Pent Coat 3",  category: 'pent-coat', aiDescription: 'men\'s full body pent coat outfit, designer pent coat with kurta and trousers, festive occasion wear, complete outfit including pants, full sleeves, knee length coat, premium fabric, show full body' },
  { id: 'garment-4',  image: '/catalog/garments/g4.jpg',  name: "Men's Pent Coat 4",  category: 'pent-coat', aiDescription: 'men\'s full body pent coat outfit, embroidered pent coat with kurta and trousers, traditional formal wear, complete outfit including pants, full sleeves, knee length coat, rich brocade, show entire outfit' },
  { id: 'garment-5',  image: '/catalog/garments/g5.jpg',  name: "Men's Pent Coat 5",  category: 'pent-coat', aiDescription: 'men\'s full body pent coat outfit, royal pent coat with kurta and trousers, ceremonial prince coat, complete outfit including pants, full sleeves, knee length coat, jamawar silk, show full body not just upper body' },
  // Shalwar Kameez (g6-g10)
  { id: 'garment-6',  image: '/catalog/garments/g6.jpg',  name: "Men's Shalwar Kameez 1",  category: 'shalwar-kameez', aiDescription: 'men\'s full body shalwar kameez outfit, traditional Pakistani mens outfit, long kurta top with loose shalwar pants bottom, complete two-piece outfit including pants, full sleeves, knee length kurta, show entire outfit not just shirt' },
  { id: 'garment-7',  image: '/catalog/garments/g7.jpg',  name: "Men's Shalwar Kameez 2",  category: 'shalwar-kameez', aiDescription: 'men\'s full body shalwar kameez outfit, long kurta with loose shalwar pants, traditional Pakistani mens wear, complete outfit including pants, knee length kurta, elegant flowing cut, full sleeves, side slits, show full body' },
  { id: 'garment-8',  image: '/catalog/garments/g8.jpg',  name: "Men's Shalwar Kameez 3",  category: 'shalwar-kameez', aiDescription: 'men\'s full body shalwar kameez outfit, embroidered kurta with loose shalwar pants, traditional festive mens wear, complete outfit including pants, knee length kurta, full sleeves, rich fabric, ceremonial style, show entire outfit' },
  { id: 'garment-9',  image: '/catalog/garments/g9.jpg',  name: "Men's Shalwar Kameez 4",  category: 'shalwar-kameez', aiDescription: 'men\'s full body shalwar kameez outfit, traditional South Asian mens outfit, long kurta top with loose shalwar pants bottom, complete two-piece outfit including pants, full sleeves, knee length kurta, show full body not just upper body' },
  { id: 'garment-10', image: '/catalog/garments/g10.jpg', name: "Men's Shalwar Kameez 5", category: 'shalwar-kameez', aiDescription: 'men\'s full body shalwar kameez outfit, long kurta with loose shalwar pants, traditional Indian Pakistani mens wear, complete outfit including pants, knee length kurta, cotton silk blend, full sleeves, straight elegant cut, show entire outfit' },
];

export const products = categories.flatMap((category, categoryIndex) => {
  const seed = categorySeeds[category.id];
  const isUnstitchedCategory = category.id.startsWith('unstitched-');

  return Array.from({ length: PRODUCTS_PER_CATEGORY }, (_, index) => {
    const descriptor = descriptors[index];
    const baseName = seed.baseNames[index % seed.baseNames.length];
    const fabric = seed.fabrics[index % seed.fabrics.length];
    const colors = seed.palettes[index % seed.palettes.length];
    const imagePrompt = getCategoryPrompt(category.label, fabric, colors);
    
    let productImageIndex;
    if (category.id === 'pent-coat' || category.id === 'unstitched-pent-coat') {
      productImageIndex = 1 + index;
    } else {
      productImageIndex = 6 + index;
    }

    const supportsUnstitched = seed.availableModes.includes('unstitched');
    const swatchColors = colors.slice(0, 3);

    const brands = ['Gul Ahmed', 'J.', 'Alkaram', 'Khaadi', 'Bonanza Satrangi', 'Edenrobe'];
    const brand = brands[index % brands.length];

    const garmentIndex = productImageIndex - 1;
    const aiDescription = allGarments[garmentIndex]?.aiDescription || seed.description;

    const colorImages = colors.map((color, colorIndex) => ({
      color: color,
      image: isUnstitchedCategory
        ? `/catalog/garments/us_${productImageIndex}-${colorIndex + 1}.jpg`
        : `/catalog/garments/g${productImageIndex}-${colorIndex + 1}.jpg`
    }));

    const unstitchedColorImages = colors.map((color, colorIndex) => {
      let imagePath = `/catalog/garments/us_${productImageIndex}-${colorIndex + 1}.jpg`;
      if (productImageIndex === 1) {
        if (color === 'Ivory') imagePath = '/catalog/garments/us_1-1.jpg';
        else if (color === 'Gold') imagePath = '/catalog/garments/us_1-2.jpg';
        else if (color === 'Black') imagePath = '/catalog/garments/us_1-3.jpg';
        else if (color === 'Maroon') imagePath = '/catalog/garments/us_1-4.jpg';
      }
      return {
        color: color,
        image: imagePath,
      };
    });

    return {
      id: `${category.id}-${index + 1}`,
      name: `${descriptor} ${baseName}`,
      brand: brand,
      description: `${seed.description} This piece by ${brand} is designed in ${fabric} and offered in ${colors.join(', ')} tones.`,
      price: seed.basePrice + (index % 8) * seed.step + (categoryIndex % 2) * 120,
      category: category.id,
      wearType: seed.wearType,
      image: colorImages[0]?.image || `/catalog/garments/g${productImageIndex}.jpg`,
      unstitchedImage: unstitchedColorImages[0]?.image || `/catalog/garments/us_${productImageIndex}.jpg`,
      unstitchedColorImages,
      imagePrompt,
      availableModes: seed.availableModes,
      fabric,
      colors,
      colorImages,
      sizes: seed.sizes,
      featured: index === 0,
      hasWaistcoatOption: seed.hasWaistcoatOption,
      suitOptions: seed.suitOptions,
      aiDescription,
      fabricSwatches: supportsUnstitched
        ? swatchColors.map((color, swatchIndex) =>
            `https://loremflickr.com/400/400/fabric,texture,${color.replace(' ','')}/all?random=${index * 10 + swatchIndex}`
          )
        : undefined,
    };
  });
});
