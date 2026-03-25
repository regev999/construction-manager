export type PriceCategory = 'land' | 'planning' | 'structure' | 'electrical' | 'plumbing' | 'finish' | 'legal' | 'extras'
export type PriceType = 'fixed' | 'semi_dynamic'

export interface PriceItem {
  id: string
  name: string
  category: PriceCategory
  price_type: PriceType
  base_min: number   // ₪ — for semi_dynamic structure: price per sqm
  base_max: number
  phase: string
  explanation: string
  note?: string
  quoteCategory?: string  // maps to quotes.category
}

export const PRICE_ITEMS: PriceItem[] = [
  // קרקע
  {
    id: 'soil_test',
    name: 'בדיקה גאוטכנית (קרקע)',
    category: 'land',
    price_type: 'fixed',
    base_min: 3000,
    base_max: 10000,
    phase: 'קרקע',
    explanation: 'טווח מחירים מקובל בשוק',
    note: 'חובה לפני הגשת תוכניות לבנייה',
  },
  {
    id: 'surveyor',
    name: 'מדידה ומודד מוסמך',
    category: 'land',
    price_type: 'fixed',
    base_min: 4000,
    base_max: 8000,
    phase: 'קרקע',
    explanation: 'טווח מחירים מקובל בשוק',
  },
  {
    id: 'lawyer',
    name: 'שכ"ט עו"ד (עסקת מקרקעין)',
    category: 'legal',
    price_type: 'fixed',
    base_min: 5000,
    base_max: 15000,
    phase: 'קרקע',
    explanation: 'הערכה לפי פרויקטים דומים',
    note: 'לא כולל מס רכישה',
  },

  // תכנון והיתר
  {
    id: 'architect',
    name: 'אדריכל ותכנון',
    category: 'planning',
    price_type: 'semi_dynamic',
    base_min: 40000,
    base_max: 100000,
    phase: 'היתר',
    explanation: 'הערכה לפי פרויקטים דומים',
    note: 'משתנה לפי שטח הבית ומורכבות התכנון',
    quoteCategory: 'planning',
  },
  {
    id: 'permit_fees',
    name: 'אגרות היתר',
    category: 'planning',
    price_type: 'fixed',
    base_min: 15000,
    base_max: 40000,
    phase: 'היתר',
    explanation: 'תלוי בוועדה המקומית ובשטח הבנייה',
  },

  // שלד
  {
    id: 'excavation',
    name: 'עבודות עפר וחפירה',
    category: 'structure',
    price_type: 'fixed',
    base_min: 20000,
    base_max: 60000,
    phase: 'שלד',
    explanation: 'תלוי בסוג קרקע ועומק חפירה',
    quoteCategory: 'excavation',
  },
  {
    id: 'structure',
    name: 'שלד (יסודות + בנייה)',
    category: 'structure',
    price_type: 'semi_dynamic',  // base = price per sqm
    base_min: 3500,
    base_max: 5500,
    phase: 'שלד',
    explanation: 'הערכה לפי פרויקטים דומים',
    note: 'המחיר בפועל תלוי בקבלן ובבחירות שלך',
    quoteCategory: 'structure',
  },

  // תשתיות
  {
    id: 'electrical',
    name: 'חשמל',
    category: 'electrical',
    price_type: 'semi_dynamic',
    base_min: 30000,
    base_max: 70000,
    phase: 'גמר',
    explanation: 'הערכה לפי פרויקטים דומים',
    note: 'המחיר בפועל תלוי בקבלן ובבחירות שלך',
    quoteCategory: 'electrical',
  },
  {
    id: 'plumbing',
    name: 'אינסטלציה',
    category: 'plumbing',
    price_type: 'semi_dynamic',
    base_min: 40000,
    base_max: 80000,
    phase: 'גמר',
    explanation: 'הערכה לפי פרויקטים דומים',
    quoteCategory: 'plumbing',
  },

  // גמר
  {
    id: 'finish',
    name: 'גמר (ריצוף, גבס, צבע, מטבח, אלומיניום)',
    category: 'finish',
    price_type: 'semi_dynamic',
    base_min: 250000,
    base_max: 600000,
    phase: 'גמר',
    explanation: 'הערכה לפי פרויקטים דומים',
    note: 'טווח רחב — תלוי ברמת הגמר ובחירות החומרים',
  },
]

// נוסף רק כש-has_basement=true
export const BASEMENT_ITEM: PriceItem = {
  id: 'basement',
  name: 'מרתף',
  category: 'structure',
  price_type: 'semi_dynamic',  // price per sqm of basement
  base_min: 4000,
  base_max: 7000,
  phase: 'שלד',
  explanation: 'עלות למ"ר מרתף — הערכה לפי פרויקטים דומים',
  note: 'מרתף מייקר משמעותית את עלויות השלד והאיטום',
}
