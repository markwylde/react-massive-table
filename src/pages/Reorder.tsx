import { ExamplePage } from '../components/ExamplePage';

export default function ReorderPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  return (
    <ExamplePage
      exampleKey="reorder"
      title="Column Reorder"
      variants={[{ name: 'Enable Reorder', props: { enableReorder: true } }]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
