'use client';

import { memo } from 'react';

interface CategoryBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  getCategoryLabel: (cat: string) => string;
}

export default memo(function CategoryBar({
  categories,
  selectedCategory,
  onSelectCategory,
  getCategoryLabel,
}: CategoryBarProps) {
  return (
    <div className="flex gap-1 lg:gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onSelectCategory(cat)}
          className={
            'px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium whitespace-nowrap transition-all ' +
            (selectedCategory === cat
              ? 'bg-[#1F2937] text-white shadow-md'
              : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50')
          }
        >
          {getCategoryLabel(cat)}
        </button>
      ))}
    </div>
  );
});
