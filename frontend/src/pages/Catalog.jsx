import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { categories } from '@/data/products';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';

const PRODUCTS_PER_PAGE = 12;

const urduCategoryLabels = {
  'pent-coat': 'پینٹ کوٹ',
  'shalwar-kameez': 'شلوار قمیض',
};

const Catalog = () => {
  const [searchParams] = useSearchParams();
  const { products, isLoadingProducts } = useStore();
  const { t, language } = useLanguage();
  const ref = useScrollAnim();

  const getInitialState = (key, defaultVal) => {
    try {
      const val = sessionStorage.getItem(`catalog_${key}`);
      return val !== null ? val : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const initialCat = searchParams.get('category') || getInitialState('category', 'all');
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [search, setSearch] = useState(() => getInitialState('search', ''));
  const [selectedFabric, setSelectedFabric] = useState(() => getInitialState('fabric', 'all'));
  const [selectedWearType, setSelectedWearType] = useState(() => getInitialState('wearType', 'all'));
  const [selectedStitchType, setSelectedStitchType] = useState(() => getInitialState('stitchType', 'all'));
  const [priceMin, setPriceMin] = useState(() => getInitialState('priceMin', ''));
  const [priceMax, setPriceMax] = useState(() => getInitialState('priceMax', ''));
  const [selectedBrand, setSelectedBrand] = useState(() => getInitialState('brand', 'all'));
  const [currentPage, setCurrentPage] = useState(() => parseInt(getInitialState('page', 1)) || 1);

  useEffect(() => {
    sessionStorage.setItem('catalog_category', selectedCategory);
    sessionStorage.setItem('catalog_search', search);
    sessionStorage.setItem('catalog_fabric', selectedFabric);
    sessionStorage.setItem('catalog_wearType', selectedWearType);
    sessionStorage.setItem('catalog_stitchType', selectedStitchType);
    sessionStorage.setItem('catalog_priceMin', priceMin);
    sessionStorage.setItem('catalog_priceMax', priceMax);
    sessionStorage.setItem('catalog_brand', selectedBrand);
    sessionStorage.setItem('catalog_page', currentPage);
  }, [selectedCategory, search, selectedFabric, selectedWearType, selectedStitchType, priceMin, priceMax, selectedBrand, currentPage]);

  const fabrics = useMemo(() => [...new Set(products.map(item => item.fabric).filter(Boolean))], [products]);
  const brands = useMemo(() => [...new Set(products.map(item => item.brand).filter(Boolean))], [products]);

  const categoryLabel = id => language === 'ur' ? urduCategoryLabels[id] : categories.find(item => item.id === id)?.label || id;

  const parsePriceInput = value => {
    if (!value.trim()) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const filtered = useMemo(() => products.filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;
    if (selectedFabric !== 'all' && p.fabric !== selectedFabric) return false;
    if (selectedWearType !== 'all' && p.wearType !== selectedWearType) return false;
    if (selectedStitchType === 'stitched' && p.category.startsWith('unstitched-')) return false;
    if (selectedStitchType === 'unstitched' && !p.category.startsWith('unstitched-')) return false;
    const min = parsePriceInput(priceMin);
    const max = parsePriceInput(priceMax);
    if (min !== null && p.price < min) return false;
    if (max !== null && p.price > max) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!`${p.name} ${p.brand} ${p.description} ${p.fabric} ${p.colors.join(' ')}`.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [products, selectedCategory, selectedFabric, selectedWearType, selectedStitchType, priceMin, priceMax, search]);

  const SECTIONS = [
    { id: 'all', label: 'All', labelUr: 'تمام' },
    { id: 'pent-coat', label: 'Pent Coat', labelUr: 'پینٹ کوٹ', categories: ['pent-coat'] },
    { id: 'shalwar-kameez', label: 'Shalwar Kameez', labelUr: 'شلوار قمیض', categories: ['shalwar-kameez'] },
  ];
  const [activeSection, setActiveSection] = useState('all');

  const sectionFiltered = activeSection === 'all' ? filtered : filtered.filter(p => SECTIONS.find(s => s.id === activeSection)?.categories?.includes(p.category));
  const sectionTotalPages = Math.ceil(sectionFiltered.length / PRODUCTS_PER_PAGE);
  const sectionPaginated = sectionFiltered.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const handleCategoryChange = (cat) => { setSelectedCategory(cat); setActiveSection(cat === 'all' ? 'all' : cat); setCurrentPage(1); };
  const handleSearch = (val) => { setSearch(val); setCurrentPage(1); };
  const clearAllFilters = () => { setSelectedCategory('all'); setSelectedBrand('all'); setSelectedFabric('all'); setSelectedWearType('all'); setSelectedStitchType('all'); setPriceMin(''); setPriceMax(''); setSearch(''); setCurrentPage(1); setActiveSection('all'); };

  if (isLoadingProducts) {
    return (
      <Layout>
        <div className="container py-5 text-center mt-5">
          <div className="spinner-border text-accent mb-3" role="status"></div>
          <p className="text-muted">{language === 'ur' ? 'مصنوعات لوڈ ہو رہی ہیں...' : 'Loading products...'}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-4" ref={ref}>
        <div className="mb-4 scroll-anim">
          <h1 className="font-playfair fw-bold fs-2">
            {t('catalog.titleA')} <span className="text-accent">{t('catalog.titleB')}</span>
          </h1>
          <p className="text-muted mt-1">{t('catalog.subtitle')}</p>
        </div>

        {/* Section Tabs */}
        <div className="d-flex flex-wrap gap-2 mb-3 scroll-anim">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); setSelectedCategory(s.id); setCurrentPage(1); }}
              className={`th-filter-btn ${activeSection === s.id ? 'active' : ''}`}>
              {language === 'ur' ? s.labelUr : s.label}
            </button>
          ))}
        </div>

        {/* Horizontal Quick Filter Bar */}
        <div className="th-filter-bar mb-3 p-2 rounded-3" style={{ background: '#f8f5ef', border: '1px solid var(--th-border)' }}>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {/* Category Boxes */}
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted small fw-medium" style={{ fontSize: '0.7rem' }}>{t('catalog.categories')}:</span>
              <div className="d-flex flex-wrap gap-1">
                <button
                  onClick={() => handleCategoryChange('all')}
                  className={`th-filter-box ${selectedCategory === 'all' ? 'active' : ''}`}
                >
                  {t('catalog.allProducts')}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`th-filter-box ${selectedCategory === cat.id ? 'active' : ''}`}
                  >
                    {language === 'ur' ? urduCategoryLabels[cat.id] : cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fabric Boxes */}
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted small fw-medium" style={{ fontSize: '0.7rem' }}>{t('catalog.fabricType')}:</span>
              <div className="d-flex flex-wrap gap-1">
                <button
                  onClick={() => { setSelectedFabric('all'); setCurrentPage(1); }}
                  className={`th-filter-box ${selectedFabric === 'all' ? 'active' : ''}`}
                >
                  {t('catalog.allProducts')}
                </button>
                {fabrics.slice(0, 5).map(f => (
                  <button
                    key={f}
                    onClick={() => { setSelectedFabric(f); setCurrentPage(1); }}
                    className={`th-filter-box ${selectedFabric === f ? 'active' : ''}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Stitch Type Boxes */}
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted small fw-medium" style={{ fontSize: '0.7rem' }}>{t('catalog.stitched')}:</span>
              <div className="d-flex flex-wrap gap-1">
                {['all', 'stitched', 'unstitched'].map(st => (
                  <button
                    key={st}
                    onClick={() => { setSelectedStitchType(st); setCurrentPage(1); }}
                    className={`th-filter-box ${selectedStitchType === st ? 'active' : ''}`}
                  >
                    {st === 'all' ? (language === 'ur' ? 'سب' : 'All') : st === 'stitched' ? t('catalog.stitched') : t('catalog.unstitched')}
                  </button>
                ))}
              </div>
            </div>

            {/* Wear Type Boxes */}
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted small fw-medium" style={{ fontSize: '0.7rem' }}>{t('catalog.wearType')}:</span>
              <div className="d-flex flex-wrap gap-1">
                <button
                  onClick={() => { setSelectedWearType('all'); setCurrentPage(1); }}
                  className={`th-filter-box ${selectedWearType === 'all' ? 'active' : ''}`}
                >
                  {t('catalog.allProducts')}
                </button>
                <button
                  onClick={() => { setSelectedWearType('traditional'); setCurrentPage(1); }}
                  className={`th-filter-box ${selectedWearType === 'traditional' ? 'active' : ''}`}
                >
                  {t('catalog.traditional')}
                </button>
                <button
                  onClick={() => { setSelectedWearType('formal'); setCurrentPage(1); }}
                  className={`th-filter-box ${selectedWearType === 'formal' ? 'active' : ''}`}
                >
                  {t('catalog.formal')}
                </button>
              </div>
            </div>

            {/* Price Range Boxes */}
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted small fw-medium" style={{ fontSize: '0.7rem' }}>{t('catalog.priceRange')}:</span>
              <div className="d-flex flex-wrap gap-1">
                <button
                  onClick={() => { setPriceMin(''); setPriceMax(''); setCurrentPage(1); }}
                  className={`th-filter-box ${!priceMin && !priceMax ? 'active' : ''}`}
                >
                  {t('catalog.allProducts')}
                </button>
                <button
                  onClick={() => { setPriceMin('0'); setPriceMax('5000'); setCurrentPage(1); }}
                  className={`th-filter-box ${priceMin === '0' && priceMax === '5000' ? 'active' : ''}`}
                >
                  Under 5K
                </button>
                <button
                  onClick={() => { setPriceMin('5000'); setPriceMax('10000'); setCurrentPage(1); }}
                  className={`th-filter-box ${priceMin === '5000' && priceMax === '10000' ? 'active' : ''}`}
                >
                  5K - 10K
                </button>
                <button
                  onClick={() => { setPriceMin('10000'); setPriceMax('15000'); setCurrentPage(1); }}
                  className={`th-filter-box ${priceMin === '10000' && priceMax === '15000' ? 'active' : ''}`}
                >
                  10K - 15K
                </button>
                <button
                  onClick={() => { setPriceMin('15000'); setPriceMax('999999'); setCurrentPage(1); }}
                  className={`th-filter-box ${priceMin === '15000' && priceMax === '999999' ? 'active' : ''}`}
                >
                  15K+
                </button>
              </div>
            </div>

            {/* Clear Filters Button */}
            <button
              className="btn btn-sm btn-outline-danger ms-auto"
              style={{ fontSize: '0.7rem', padding: '4px 12px' }}
              onClick={clearAllFilters}
            >
              {t('catalog.clearFilters')}
            </button>
          </div>
        </div>

        {/* Search + Count */}
        <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-4">
          <div className="position-relative" style={{ maxWidth: 400, width: '100%' }}>
            <Search size={16} className="position-absolute text-muted" style={{ top: '50%', left: 12, transform: 'translateY(-50%)' }} />
            <input className="th-input" style={{ paddingLeft: 36 }} placeholder={t('catalog.search')} value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">{filtered.length} {t('catalog.allProducts', 'products')}</span>
          </div>
        </div>

        <div className="row g-4">
          {/* Product Grid */}
          <div className="col-12">
            {selectedCategory !== 'all' && (
              <div className="mb-3">
                <span className="th-badge th-badge-soft d-inline-flex align-items-center gap-2">
                  {categoryLabel(selectedCategory)}
                  <Button variant="ghost" size="sm" className="p-0" onClick={() => handleCategoryChange('all')}><X size={14} /></Button>
                </span>
              </div>
            )}

            <div className="row g-4">
              {sectionPaginated.map((product, i) => (
                <div key={product.id} className="col-6 col-lg-4">
                  <Link to={`/product/${product.id}`} className="text-decoration-none h-100 d-block">
                    <div className="th-card scroll-anim h-100 d-flex flex-column" style={{ transitionDelay: `${i * 0.05}s` }}>
                      <div className="th-product-img-wrap" style={{ opacity: product.isSoldOut ? 0.6 : 1 }}>
                        <img src={product.image} alt={product.name} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }} />
                        {product.isSoldOut && (
                          <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 10 }}>
                            <span className="badge bg-danger px-3 py-2 fs-6 shadow-sm" style={{ letterSpacing: '1px' }}>SOLD OUT</span>
                          </div>
                        )}
                        <div className="th-product-badges">
                          <span className="th-badge th-badge-accent">{t(`catalog.${product.wearType}`, product.wearType)}</span>
                          {product.availableModes.includes('custom-stitching') && <span className="th-badge th-badge-outline">{t('catalog.custom')}</span>}
                        </div>
                      </div>
                      <div className="p-3 d-flex flex-column flex-grow-1">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <p className="text-uppercase text-muted m-0" style={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}>{product.brand}</p>
                          <p className="text-uppercase text-muted m-0" style={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}>{product.fabric}</p>
                        </div>
                        <h6 className="font-playfair fw-semibold mb-2 text-dark" style={{ fontSize: '0.95rem' }}>{product.name}</h6>
                        <div className="d-flex align-items-center justify-content-between mt-auto">
                          <span className="fw-bold text-dark">Rs. {product.price.toLocaleString()}</span>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>{product.sizes.length} {t('catalog.sizesCount')}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {sectionTotalPages > 1 && (
              <div className="d-flex align-items-center justify-content-center gap-2 mt-5">
                <Button variant="outline" size="sm" className="d-flex align-items-center gap-1" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft size={16} /> {t('catalog.previous')}
                </Button>
                {Array.from({ length: sectionTotalPages }, (_, i) => i + 1).map(page => (
                  <Button key={page} onClick={() => setCurrentPage(page)} size="sm"
                    variant={currentPage === page ? 'default' : 'outline'}>
                    {page}
                  </Button>
                ))}
                <Button variant="outline" size="sm" className="d-flex align-items-center gap-1" disabled={currentPage === sectionTotalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  {t('catalog.next')} <ChevronRight size={16} />
                </Button>
              </div>
            )}

            {sectionFiltered.length === 0 && (
              <div className="text-center text-muted py-5">
                <p className="fs-5">{t('catalog.noProducts')}</p>
                <p className="small">{t('catalog.tryFilters')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Catalog;
