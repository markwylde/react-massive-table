import { ExamplePage } from '../components/ExamplePage';

export default function ResizePage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  return (
    <ExamplePage
      exampleKey="resize"
      title="Column Resize"
      variants={[{ name: 'Enable Resize', props: { enableResize: true } }]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
