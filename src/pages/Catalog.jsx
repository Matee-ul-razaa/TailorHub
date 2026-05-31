import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { categories } from '@/data/products';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';

const PRODUCTS_PER_PAGE = 12;

const urduCategoryLabels = {
  shirts: 'شرٹس', 't-shirts': 'ٹی شرٹس', 'kurta-pajama': 'کرتا پاجامہ',
  'shalwar-kameez': 'شلوار قمیض', pants: 'پینٹس', suits: 'سوٹس',
  coats: 'کوٹس', 'polo-shirts': 'پولو شرٹس',
};

const Catalog = () => {
  const [searchParams] = useSearchParams();
  const { products } = useStore();
  const { t, language } = useLanguage();
  const ref = useScrollAnim();

  const initialCat = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState(initialCat || 'all');
  const [search, setSearch] = useState('');
  const [selectedFabric, setSelectedFabric] = useState('all');
  const [selectedWearType, setSelectedWearType] = useState('all');
  const [selectedStitchType, setSelectedStitchType] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
    if (selectedStitchType === 'stitched') {
      if (!p.availableModes.includes('ready-to-wear') && !p.availableModes.includes('custom-stitching')) return false;
    }
    if (selectedStitchType === 'unstitched' && !p.availableModes.includes('unstitched')) return false;
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
    { id: 'formal', label: 'Formal', labelUr: 'فارمل', categories: ['suits', 'shirts'] },
    { id: 'casual', label: 'Casual', labelUr: 'کیژوئل', categories: ['t-shirts', 'polo-shirts', 'pants'] },
    { id: 'event', label: 'Event / Wedding', labelUr: 'تقریب / شادی', categories: ['kurta-pajama', 'shalwar-kameez', 'coats'] },
  ];
  const [activeSection, setActiveSection] = useState('all');

  const sectionFiltered = activeSection === 'all' ? filtered : filtered.filter(p => SECTIONS.find(s => s.id === activeSection)?.categories?.includes(p.category));
  const sectionTotalPages = Math.ceil(sectionFiltered.length / PRODUCTS_PER_PAGE);
  const sectionPaginated = sectionFiltered.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const handleCategoryChange = (cat) => { setSelectedCategory(cat); setCurrentPage(1); };
  const handleSearch = (val) => { setSearch(val); setCurrentPage(1); };
  const clearAllFilters = () => { setSelectedCategory('all'); setSelectedBrand('all'); setSelectedFabric('all'); setSelectedWearType('all'); setSelectedStitchType('all'); setPriceMin(''); setPriceMax(''); setSearch(''); setCurrentPage(1); setActiveSection('all'); };

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
            <button key={s.id} onClick={() => { setActiveSection(s.id); setCurrentPage(1); }}
              className={`th-filter-btn ${activeSection === s.id ? 'active' : ''}`}>
              {language === 'ur' ? s.labelUr : s.label}
            </button>
          ))}
        </div>

        {/* Stitch Toggle */}
        <div className="d-inline-flex gap-1 p-1 rounded-3 mb-3" style={{ background: '#e9ecef' }}>
          {['all', 'stitched', 'unstitched'].map(st => (
            <button key={st} onClick={() => { setSelectedStitchType(st); setCurrentPage(1); }}
              className={`th-filter-btn ${selectedStitchType === st ? 'active' : ''}`} style={{ fontSize: '0.8rem' }}>
              {st === 'all' ? (language === 'ur' ? 'سب' : 'All') : st === 'stitched' ? t('catalog.stitched') : t('catalog.unstitched')}
            </button>
          ))}
        </div>

        {/* Search + Count */}
        <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-4">
          <div className="position-relative" style={{ maxWidth: 400, width: '100%' }}>
            <Search size={16} className="position-absolute text-muted" style={{ top: '50%', left: 12, transform: 'translateY(-50%)' }} />
            <input className="th-input" style={{ paddingLeft: 36 }} placeholder={t('catalog.search')} value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">{filtered.length} {t('catalog.allProducts', 'products')}</span>
            <button className="btn btn-outline-secondary btn-sm d-sm-none d-flex align-items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal size={16} /> {t('catalog.filters')}
            </button>
          </div>
        </div>

        <div className="row g-4">
          {/* Sidebar Filters */}
          <div className={`col-sm-4 col-lg-3 ${showFilters ? '' : 'd-none d-sm-block'}`}>
            <div className="th-card-static p-3 position-sticky" style={{ top: 80 }}>
              <h6 className="th-label mb-3">{t('catalog.categories')}</h6>
              <button onClick={() => handleCategoryChange('all')} className={`d-block w-100 text-start rounded-2 px-3 py-2 small border-0 mb-1 ${selectedCategory === 'all' ? 'bg-accent-light text-accent fw-medium' : 'bg-transparent text-muted'}`}>
                {t('catalog.allProducts')}
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => handleCategoryChange(cat.id)} className={`d-block w-100 text-start rounded-2 px-3 py-2 small border-0 mb-1 ${selectedCategory === cat.id ? 'bg-accent-light text-accent fw-medium' : 'bg-transparent text-muted'}`}>
                  {cat.icon} {language === 'ur' ? urduCategoryLabels[cat.id] : cat.label}
                </button>
              ))}

              <hr className="th-separator" />
              <h6 className="th-label">{t('catalog.fabricType')}</h6>
              <select className="th-select mb-3" value={selectedFabric} onChange={e => { setSelectedFabric(e.target.value); setCurrentPage(1); }}>
                <option value="all">{t('catalog.allProducts')}</option>
                {fabrics.map(f => <option key={f} value={f}>{f}</option>)}
              </select>

              <h6 className="th-label">{t('catalog.brands')}</h6>
              <select className="th-select mb-3" value={selectedBrand} onChange={e => { setSelectedBrand(e.target.value); setCurrentPage(1); }}>
                <option value="all">{t('catalog.allBrands')}</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <h6 className="th-label">{t('catalog.wearType')}</h6>
              <select className="th-select mb-3" value={selectedWearType} onChange={e => { setSelectedWearType(e.target.value); setCurrentPage(1); }}>
                <option value="all">{t('catalog.allProducts')}</option>
                <option value="traditional">{t('catalog.traditional')}</option>
                <option value="western">{t('catalog.western')}</option>
              </select>

              <h6 className="th-label">{t('catalog.priceRange')}</h6>
              <div className="row g-2 mb-3">
                <div className="col-6"><input className="th-input" type="number" placeholder="Min" value={priceMin} onChange={e => { setPriceMin(e.target.value); setCurrentPage(1); }} /></div>
                <div className="col-6"><input className="th-input" type="number" placeholder="Max" value={priceMax} onChange={e => { setPriceMax(e.target.value); setCurrentPage(1); }} /></div>
              </div>

              <button className="btn btn-outline-secondary btn-sm w-100" onClick={clearAllFilters}>{t('catalog.clearFilters')}</button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="col-sm-8 col-lg-9">
            {selectedCategory !== 'all' && (
              <div className="mb-3">
                <span className="th-badge th-badge-soft d-inline-flex align-items-center gap-2">
                  {categoryLabel(selectedCategory)}
                  <button onClick={() => handleCategoryChange('all')} className="btn p-0 border-0 lh-1"><X size={14} /></button>
                </span>
              </div>
            )}

            <div className="row g-4">
              {sectionPaginated.map((product, i) => (
                <div key={product.id} className="col-6 col-lg-4">
                  <Link to={`/product/${product.id}`} className="text-decoration-none h-100 d-block">
                    <div className="th-card scroll-anim h-100 d-flex flex-column" style={{ transitionDelay: `${i * 0.05}s` }}>
                      <div className="th-product-img-wrap">
                        <img src={product.image} alt={product.name} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }} />
                        <div className="th-product-badges">
                          <span className="th-badge th-badge-accent">{product.wearType === 'traditional' ? t('catalog.traditional') : t('catalog.western')}</span>
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
                <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft size={16} /> Previous
                </button>
                {Array.from({ length: sectionTotalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`btn btn-sm ${currentPage === page ? 'btn-accent' : 'btn-outline-secondary'}`}>
                    {page}
                  </button>
                ))}
                <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" disabled={currentPage === sectionTotalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  Next <ChevronRight size={16} />
                </button>
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
