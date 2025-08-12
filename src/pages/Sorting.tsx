import { ExamplePage } from '../components/ExamplePage';
import type { Sort } from '../lib/types';

export default function SortingPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  return (
    <ExamplePage
      exampleKey="sorting"
      title="Sorting"
      variants={[
        { name: 'Enable Sorting', props: { enableSort: true } },
        {
          name: 'Default Sorts',
          props: { enableSort: true, defaultSorts: [{ path: ['lastName'], dir: 'asc' }] as Sort[] },
          note: 'Pre-sorted by Last Name ascending.',
        },
      ]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
