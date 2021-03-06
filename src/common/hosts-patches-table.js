import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import React from 'react'
import { Portal } from 'react-overlays'

import _ from './intl'
import ActionButton from './action-button'
import Component from './base-component'
import forEach from 'lodash/forEach'
import Link from './link'
import propTypes from './prop-types'
import SortedTable from './sorted-table'
import TabButton from './tab-button'
import { connectStore } from './utils'
import {
  createGetObjectsOfType,
  createFilter,
  createSelector
} from './selectors'
import {
  getHostMissingPatches,
  installAllHostPatches
} from './xo'

// ===================================================================

const MISSING_PATCHES_COLUMNS = [
  {
    name: _('srHost'),
    itemRenderer: host => <Link to={`/hosts/${host.id}`}>{host.name_label}</Link>,
    sortCriteria: host => host.name_label
  },
  {
    name: _('hostDescription'),
    itemRenderer: host => host.name_description,
    sortCriteria: host => host.name_description
  },
  {
    name: _('hostMissingPatches'),
    itemRenderer: (host, { missingPatches }) => <Link to={`/hosts/${host.id}/patches`}>{missingPatches[host.id]}</Link>,
    sortCriteria: (host, { missingPatches }) => missingPatches[host.id]
  },
  {
    name: _('patchUpdateButton'),
    itemRenderer: (host, { installAllHostPatches }) => (
      <ActionButton
        btnStyle='primary'
        handler={installAllHostPatches}
        handlerParam={host}
        icon='host-patch-update'
      />
    )
  }
]

const POOLS_MISSING_PATCHES_COLUMNS = [{
  name: _('srPool'),
  itemRenderer: (host, { pools }) => {
    const pool = pools[host.$pool]
    return <Link to={`/pools/${pool.id}`}>{pool.name_label}</Link>
  },
  sortCriteria: (host, { pools }) => pools[host.$pool].name_label
}].concat(MISSING_PATCHES_COLUMNS)

// ===================================================================

class HostsPatchesTable extends Component {
  constructor (props) {
    super(props)
    this.state.missingPatches = {}
  }

  _getHosts = createFilter(
    () => this.props.hosts,
    createSelector(
      () => this.state.missingPatches,
      missingPatches => host => missingPatches[host.id]
    )
  )

  _refreshMissingPatches = () => (
    Promise.all(
      map(this.props.hosts, this._refreshHostMissingPatches)
    )
  )

  _installAllMissingPatches = () => (
    Promise.all(map(this._getHosts(), this._installAllHostPatches))
  )

  _refreshHostMissingPatches = host => (
    getHostMissingPatches(host).then(patches => {
      this.setState({
        missingPatches: {
          ...this.state.missingPatches,
          [host.id]: patches.length
        }
      })
    })
  )

  _installAllHostPatches = host => (
    installAllHostPatches(host).then(() =>
      this._refreshHostMissingPatches(host)
    )
  )

  componentWillMount () {
    this._refreshMissingPatches()
  }

  componentDidMount () {
    // Force one Portal refresh.
    // Because Portal cannot see the container reference at first rendering.
    this.forceUpdate()
  }

  componentWillReceiveProps (nextProps) {
    forEach(nextProps.hosts, host => {
      const { id } = host

      if (this.state.missingPatches[id] !== undefined) {
        return
      }

      this.setState({
        missingPatches: {
          ...this.state.missingPatches,
          [id]: 0
        }
      })

      this._refreshHostMissingPatches(host)
    })
  }

  render () {
    const hosts = this._getHosts()
    const noPatches = isEmpty(hosts)
    const { props } = this

    const Container = props.container || 'div'
    const Button = props.useTabButton ? TabButton : ActionButton

    const Buttons = (
      <Container>
        <Button
          btnStyle='secondary'
          handler={this._refreshMissingPatches}
          icon='refresh'
          labelId='refreshPatches'
        />
        <Button
          btnStyle='primary'
          disabled={noPatches}
          handler={this._installAllMissingPatches}
          icon='host-patch-update'
          labelId='installPoolPatches'
        />
      </Container>
    )

    return (
      <div>
        {!noPatches
          ? (
          <SortedTable
            collection={hosts}
            columns={props.displayPools ? POOLS_MISSING_PATCHES_COLUMNS : MISSING_PATCHES_COLUMNS}
            userData={{
              installAllHostPatches: this._installAllHostPatches,
              missingPatches: this.state.missingPatches,
              pools: props.pools
            }}
          />
          ) : <p>{_('patchNothing')}</p>
        }
        <Portal container={() => props.buttonsGroupContainer()}>
          {Buttons}
        </Portal>
      </div>
    )
  }
}

// ===================================================================

@connectStore(() => {
  const getPools = createGetObjectsOfType('pool')

  return {
    pools: getPools
  }
})
class HostsPatchesTableByPool extends Component {
  render () {
    const { props } = this
    return <HostsPatchesTable {...props} pools={props.pools} />
  }
}

// ===================================================================

export default propTypes({
  buttonsGroupContainer: propTypes.func.isRequired,
  container: propTypes.any,
  displayPools: propTypes.bool,
  hosts: propTypes.oneOfType([
    propTypes.arrayOf(propTypes.object),
    propTypes.objectOf(propTypes.object)
  ]).isRequired,
  useTabButton: propTypes.bool
})(props => props.displayPools
  ? <HostsPatchesTableByPool {...props} />
  : <HostsPatchesTable {...props} />
)
