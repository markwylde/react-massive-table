import { ExamplePage } from '../components/ExamplePage';

export default function AllFeaturesPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  return (
    <ExamplePage
      exampleKey="all"
      title="All Features"
      variants={[
        {
          name: 'Sortable + Reorder + Resize + Group Bar',
          props: {
            enableSort: true,
            enableReorder: true,
            enableResize: true,
            showGroupByDropZone: true,
          },
        },
      ]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
