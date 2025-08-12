import { ExamplePage } from '../components/ExamplePage';

export default function GroupingPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  return (
    <ExamplePage
      exampleKey="grouping"
      title="Grouping"
      variants={[
        { name: 'Show Group Bar', props: { showGroupByDropZone: true } },
        {
          name: 'Preset Group By Category',
          props: { showGroupByDropZone: true, defaultGroupBy: [{ path: ['category'] }] },
        },
        {
          name: 'Preset Group + Expanded',
          props: {
            showGroupByDropZone: true,
            defaultGroupBy: [{ path: ['category'] }],
            defaultExpandedKeys: ['["one"]', '["two"]', '[null]'],
          },
        },
      ]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
