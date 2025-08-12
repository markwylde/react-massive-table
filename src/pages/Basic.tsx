import { ExamplePage } from '../components/ExamplePage';

export default function BasicPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  return (
    <ExamplePage
      exampleKey="basic"
      title="Basic"
      variants={[
        { name: 'Basic Table', props: {}, note: 'No sort, reorder, resize, or group bar.' },
      ]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
