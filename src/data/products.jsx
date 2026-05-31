

export const categories = [
  { id: 'shirts', label: 'Shirts', icon: '👔', image: '/catalog/shirts.png' },
  { id: 'kurta-pajama', label: 'Kurta Pajama', icon: '🪷', image: '/catalog/kurta-pajama.png' },
  { id: 'shalwar-kameez', label: 'Shalwar Kameez', icon: '🧵', image: '/catalog/shalwar-kameez.png' },
  { id: 'pants', label: 'Pants', icon: '👖', image: '/catalog/pants.png' },
];

const PRODUCTS_PER_CATEGORY = 24;

const descriptors = [
  'Royal', 'Signature', 'Modern', 'Classic', 'Heritage', 'Urban', 'Executive', 'Refined',
  'Premier', 'Noble', 'Crafted', 'Majestic', 'Contemporary', 'Prestige', 'Tailored', 'Elite',
  'Luxe', 'Fine', 'Regal', 'Prime', 'Sophisticated', 'Timeless', 'Artisan', 'Grand',
];















const categorySeeds = {
  shirts: {
    wearType: 'western',
    baseNames: ['Oxford Shirt', 'Linen Formal Shirt', 'Mandarin Collar Shirt', 'Business Stripe Shirt'],
    fabrics: ['Egyptian Cotton', 'Pure Linen', 'Poplin Cotton', 'Cotton Sateen'],
    palettes: [
      ['White', 'Sky Blue', 'Powder Pink', 'Ivory'],
      ['Navy', 'Steel Blue', 'Ash Grey', 'Black'],
      ['Olive', 'Sand', 'Cream', 'Sage'],
    ],
    availableModes: ['ready-to-wear', 'custom-stitching', 'unstitched'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    basePrice: 4200,
    step: 250,
    description: 'A premium tailored shirt built for all-day comfort, elegant drape, and a sharp modern silhouette.',
  },
  'kurta-pajama': {
    wearType: 'traditional',
    baseNames: ['Embroidered Kurta Pajama', 'Festive Kurta Set', 'Classic Kurta Pajama', 'Wedding Kurta Ensemble'],
    fabrics: ['Jamawar Silk', 'Raw Silk', 'Brocade', 'Cotton Silk'],
    palettes: [
      ['Ivory', 'Gold', 'Maroon', 'Black'],
      ['Navy', 'Teal', 'Charcoal', 'Olive'],
      ['Cream', 'Rust', 'Bottle Green', 'Plum'],
    ],
    availableModes: ['ready-to-wear', 'custom-stitching', 'unstitched'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    basePrice: 7600,
    step: 500,
    hasWaistcoatOption: true,
    description: 'Traditional tailoring with contemporary finesse, featuring rich detailing and a ceremonial-ready finish.',
  },
  'shalwar-kameez': {
    wearType: 'traditional',
    baseNames: ['Premium Shalwar Kameez', 'Heritage Kameez Set', 'Elegant Wash & Wear Kameez', 'Classic Collar Kameez'],
    fabrics: ['Wash & Wear', 'Boski Cotton', 'Blended Wash & Wear', 'Cotton Silk'],
    palettes: [
      ['Off White', 'Charcoal', 'Navy', 'Olive'],
      ['Stone', 'Chocolate', 'Graphite', 'Ice Blue'],
      ['Cream', 'Black', 'Khaki', 'Sage'],
    ],
    availableModes: ['ready-to-wear', 'custom-stitching', 'unstitched'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    basePrice: 6200,
    step: 380,
    hasWaistcoatOption: true,
    description: 'Graceful eastern attire cut for comfort and presence, ideal for both everyday wear and special occasions.',
  },
  pants: {
    wearType: 'western',
    baseNames: ['Slim Fit Chinos', 'Tailored Trousers', 'Smart Casual Pants', 'Stretch Dress Pants'],
    fabrics: ['Stretch Cotton Twill', 'Cotton Gabardine', 'Wool Blend Twill', 'Performance Cotton'],
    palettes: [
      ['Khaki', 'Navy', 'Olive', 'Charcoal'],
      ['Black', 'Graphite', 'Steel', 'Stone'],
      ['Brown', 'Camel', 'Forest Green', 'Slate'],
    ],
    availableModes: ['ready-to-wear', 'custom-stitching'],
    sizes: ['28', '30', '32', '34', '36', '38', '40'],
    basePrice: 3600,
    step: 220,
    description: 'Sharply cut trousers offering refined structure, stretch comfort, and versatile styling for any setting.',
  },
};

const createAiImageUrl = (categoryId, index, imagePrompt) => {
  const seed = categoryId.length * 100 + index;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?seed=${seed}&width=600&height=800&nologo=true`;
};

const getCategoryPrompt = (categoryLabel, fabric, colors) =>
  `ultra realistic studio fashion catalog image of men's ${categoryLabel}, ${fabric}, ${colors.join(', ')}, full body, premium tailoring, softbox lighting, 4k detail`;

export const products = categories.flatMap((category, categoryIndex) => {
  const seed = categorySeeds[category.id];

  return Array.from({ length: PRODUCTS_PER_CATEGORY }, (_, index) => {
    const descriptor = descriptors[index];
    const baseName = seed.baseNames[index % seed.baseNames.length];
    const fabric = seed.fabrics[index % seed.fabrics.length];
    const colors = seed.palettes[index % seed.palettes.length];
    const imagePrompt = getCategoryPrompt(category.label, fabric, colors);
    const imageSeed = `${category.id}-${index + 1}`;
    const supportsUnstitched = seed.availableModes.includes('unstitched');
    const swatchColors = colors.slice(0, 3);

    const brands = ['Gul Ahmed', 'J.', 'Alkaram', 'Khaadi', 'Bonanza Satrangi', 'Edenrobe'];
    const brand = brands[index % brands.length];

    return {
      id: `${category.id}-${index + 1}`,
      name: `${descriptor} ${baseName}`,
      brand: brand,
      description: `${seed.description} This piece by ${brand} is designed in ${fabric} and offered in ${colors.join(', ')} tones.`,
      price: seed.basePrice + (index % 8) * seed.step + categoryIndex * 120,
      category: category.id,
      wearType: seed.wearType,
      image: `/catalog/${category.id}.png`,
      imagePrompt,
      availableModes: seed.availableModes,
      fabric,
      colors,
      sizes: seed.sizes,
      featured: index === 0,
      hasWaistcoatOption: seed.hasWaistcoatOption,
      suitOptions: seed.suitOptions,
      fabricSwatches: supportsUnstitched
        ? swatchColors.map((color, swatchIndex) =>
            // For swatches, fetch fabric textures
            `https://loremflickr.com/400/400/fabric,texture,${color.replace(' ','')}/all?random=${index * 10 + swatchIndex}`
          )
        : undefined,
    };
  });
});
